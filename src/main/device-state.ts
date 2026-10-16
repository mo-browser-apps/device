import { Device, Settings, type DeviceList } from './gen/devices';
import type {
  ConnectedDevices,
  ConnectedKeyboard,
  ConnectedMouse,
  RawLighting,
} from './gen/native/devices';
import { logitechModelId, logitechMouse } from './logitech';
import { toRawLighting, viaKeyboard, viaModel } from './via';

interface Entry {
  device: Device;
  settings: Settings;
  /** Added by the user, so it is listed and saved; otherwise only offered for pairing. */
  paired: boolean;
}

/** One open device, as the native module reports it. */
type Connection =
  | { connectionId: number; keyboard: ConnectedKeyboard; mouse?: undefined }
  | { connectionId: number; mouse: ConnectedMouse; keyboard?: undefined };

/** What is kept between launches. */
export interface SavedDevices {
  /** Each paired device and its last known settings, as { device, settings } JSON. */
  paired: unknown[];
}

export interface DeviceStateHooks {
  /** Writes lighting to an open keyboard; rejects if it is gone or the write fails. */
  applyLighting(connectionId: number, lighting: RawLighting): Promise<void>;
  /** Sets an open mouse's DPI; rejects if it is gone or the write fails. */
  applyDpi(connectionId: number, dpi: number): Promise<void>;
  /** Receives the complete paired-device list after each change. */
  changed(devices: DeviceList): void;
  save(saved: SavedDevices): void;
}

const MAX_SCROLL_SPEED = 5;

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Reports whether settings match the device's kind and stay within its capabilities.
 */
function isValid({ device, settings: current }: Entry, settings: Settings): boolean {
  const { mouse: spec, keyboard: keyboardSpec } = device;
  const { mouse, keyboard } = settings;
  if (spec && mouse && !keyboard) {
    return (
      isInRange(mouse.dpi, spec.minDpi, spec.maxDpi) &&
      isInRange(mouse.scrollSpeed, 1, MAX_SCROLL_SPEED) &&
      mouse.bindings.every((binding) => spec.buttons.includes(binding.control))
    );
  }
  if (keyboardSpec && keyboard && !mouse) {
    return (
      // An effect the editor cannot offer stays valid while the keyboard shows it.
      (keyboardSpec.effects.includes(keyboard.effect) ||
        keyboard.effect === current.keyboard?.effect) &&
      isInRange(keyboard.hue, 0, 359) &&
      isInRange(keyboard.brightness, 0, 100) &&
      keyboard.bindings.every((binding) => keyboardSpec.keys.includes(binding.control))
    );
  }
  return false;
}

/**
 * Restores one saved paired device, shown as disconnected until it connects; nothing if
 * the saved data does not describe a device.
 */
function restoreEntry(json: unknown): Entry | undefined {
  const { device: deviceJson, settings: settingsJson } = (json ?? {}) as Record<string, unknown>;
  const device = Device.fromJSON(deviceJson ?? {});
  const settings = Settings.fromJSON(settingsJson ?? {});
  if (!device.id || settings.deviceId !== device.id || (!device.mouse && !device.keyboard)) {
    return undefined;
  }
  const entry = { device: { ...device, connected: false }, settings, paired: true };
  return isValid(entry, settings) ? entry : undefined;
}

/**
 * Owns the application's devices: the real keyboards and mice the native module
 * reports. Connected devices are offered for pairing; paired ones are listed and saved,
 * and stay listed as disconnected while they are away. Their settings are read from the
 * hardware whenever they connect, never restored onto it.
 */
export class DeviceState {
  private readonly entries: Entry[];
  /** Open devices by device ID; a disconnected paired device keeps its entry only. */
  private readonly live = new Map<string, Connection>();

  constructor(
    saved: SavedDevices,
    private readonly hooks: DeviceStateHooks,
  ) {
    this.entries = saved.paired.flatMap((json) => restoreEntry(json) ?? []);
  }

  /** Every paired device. */
  list(): DeviceList {
    return { devices: this.entries.filter((entry) => entry.paired).map((entry) => entry.device) };
  }

  /** Connected devices available to pair. */
  discover(): DeviceList {
    return {
      devices: this.entries.filter((entry) => !entry.paired).map((entry) => entry.device),
    };
  }

  pair(deviceId: string): void {
    const entry = this.find(deviceId);
    if (!entry || entry.paired) throw new Error(`Cannot pair device: ${deviceId}`);
    entry.paired = true;
    this.save();
    this.publish();
  }

  forget(deviceId: string): void {
    const entry = this.find(deviceId);
    if (!entry?.paired) throw new Error(`Cannot forget device: ${deviceId}`);
    entry.paired = false;
    // A device that is still connected can be added again at once.
    if (!entry.device.connected) this.entries.splice(this.entries.indexOf(entry), 1);
    this.save();
    this.publish();
  }

  getSettings(deviceId: string): Settings {
    const entry = this.find(deviceId);
    if (!entry?.paired) throw new Error(`Unknown device: ${deviceId}`);
    return entry.settings;
  }

  /**
   * Validates one complete settings snapshot and writes it to the device. The settings
   * change once the device acknowledges the write.
   */
  async applySettings(settings: Settings): Promise<void> {
    const { deviceId } = settings;
    const entry = this.find(deviceId);
    if (!entry || !isValid(entry, settings)) {
      throw new Error(`Cannot apply settings to device: ${deviceId}`);
    }
    const connection = this.live.get(deviceId);
    if (!connection) throw new Error(`Device is not connected: ${deviceId}`);

    // A failed write closes the device; the native module then reports it gone.
    if (connection.keyboard) {
      await this.hooks.applyLighting(
        connection.connectionId,
        toRawLighting(settings.keyboard!, viaModel(connection.keyboard)),
      );
    } else {
      await this.hooks.applyDpi(connection.connectionId, settings.mouse!.dpi);
    }
    // Skip results for a device that was reconnected meanwhile: it has been read again.
    if (this.live.get(deviceId)?.connectionId === connection.connectionId) {
      entry.settings = settings;
    }
  }

  /**
   * Matches the complete set of open devices to entries, then publishes the change.
   */
  reconcile({ keyboards, mice }: ConnectedDevices): void {
    const connections: Connection[] = [
      ...keyboards.map((keyboard) => ({ connectionId: keyboard.connectionId, keyboard })),
      ...mice.map((mouse) => ({ connectionId: mouse.connectionId, mouse })),
    ];
    const open = new Map(connections.map((connection) => [connection.connectionId, connection]));
    let changed = false;
    let pairedLeft = false;

    for (const [deviceId, connection] of this.live) {
      const entry = this.find(deviceId)!;
      const current = open.get(connection.connectionId);
      if (current) {
        // A mouse reports its battery again every few seconds.
        const { battery, charging } = current.mouse ?? entry.device;
        if (battery !== entry.device.battery || charging !== entry.device.charging) {
          entry.device = { ...entry.device, battery, charging };
          changed = true;
        }
        continue;
      }
      this.live.delete(deviceId);
      entry.device = { ...entry.device, connected: false };
      if (entry.paired) pairedLeft = true;
      else this.entries.splice(this.entries.indexOf(entry), 1);
      changed = true;
    }

    const known = new Set([...this.live.values()].map((connection) => connection.connectionId));
    for (const connection of connections) {
      if (known.has(connection.connectionId)) continue;
      this.connect(connection);
      changed = true;
    }

    // Keeps the last known settings to show while the device is away.
    if (pairedLeft) this.save();
    if (changed) this.publish();
  }

  /**
   * A returning device takes the place of the first disconnected unit of its model, so
   * an open device page keeps working. Firmware rarely reports a serial number, so
   * further units of a model are numbered, and identical devices may swap IDs on
   * reconnect.
   */
  private connect(connection: Connection): void {
    const modelId = connection.keyboard
      ? viaModel(connection.keyboard).id
      : logitechModelId(connection.mouse);
    const entry = this.entries.find(
      (unit) => unit.device.modelId === modelId && !unit.device.connected,
    );
    let deviceId = entry?.device.id ?? modelId;
    for (let unit = 2; !entry && this.find(deviceId); unit++) deviceId = `${modelId}-${unit}`;

    const fresh = connection.keyboard
      ? viaKeyboard(deviceId, connection.keyboard)
      : logitechMouse(deviceId, connection.mouse);
    if (entry) Object.assign(entry, fresh);
    else this.entries.push({ ...fresh, paired: false });
    this.live.set(deviceId, connection);
  }

  private find(deviceId: string): Entry | undefined {
    return this.entries.find((entry) => entry.device.id === deviceId);
  }

  private save(): void {
    this.hooks.save({
      paired: this.entries
        .filter((entry) => entry.paired)
        .map((entry) => ({
          device: Device.toJSON(entry.device),
          settings: Settings.toJSON(entry.settings),
        })),
    });
  }

  private publish(): void {
    this.hooks.changed(this.list());
  }
}
