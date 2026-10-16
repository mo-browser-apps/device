import { LinkType, Settings, type Device, type DeviceList } from './gen/devices';
import type { ConnectedKeyboard, ConnectedKeyboards, RawLighting } from './gen/native/devices';
import { toRawLighting, viaKeyboard, viaModel } from './via';

interface Entry {
  device: Device;
  settings: Settings;
}

/** What is kept between launches. */
export interface SavedDevices {
  /** Undefined on the first launch, so the demo devices start paired. */
  pairedIds?: string[];
  /** Settings of simulated devices, as JSON by device ID. */
  settings: Record<string, unknown>;
}

export interface DeviceStateHooks {
  /** Writes lighting to an open keyboard; rejects if it is gone or the write fails. */
  applyLighting(connectionId: number, lighting: RawLighting): Promise<void>;
  /** Receives the complete managed-device list after each change. */
  changed(devices: DeviceList): void;
  save(saved: SavedDevices): void;
}

const MAX_SCROLL_SPEED = 5;

function makeMouse(seed: {
  id: string;
  model: string;
  link: LinkType;
  firmware: string;
  battery: number;
  charging: boolean;
  buttons: [control: string, action: string][];
  minDpi: number;
  maxDpi: number;
  dpi: number;
}): Entry {
  return {
    device: {
      id: seed.id,
      modelId: seed.id,
      model: seed.model,
      link: seed.link,
      firmware: seed.firmware,
      connected: true,
      hasBattery: true,
      battery: seed.battery,
      charging: seed.charging,
      live: false,
      mouse: {
        buttons: seed.buttons.map(([control]) => control),
        minDpi: seed.minDpi,
        maxDpi: seed.maxDpi,
      },
    },
    settings: {
      deviceId: seed.id,
      mouse: {
        bindings: seed.buttons.map(([control, action]) => ({ control, action })),
        dpi: seed.dpi,
        scrollSpeed: 3,
        naturalScroll: false,
      },
    },
  };
}

/**
 * The simulated mice: two paired, and a second unit of the first one nearby, so the
 * pairing flow is usable on a fresh launch.
 */
function simulatedDevices(): { paired: Entry[]; available: Entry[] } {
  const performance = makeMouse({
    id: 'performance-mouse',
    model: 'Performance Mouse',
    link: LinkType.RECEIVER,
    firmware: '3.2.1',
    battery: 82,
    charging: true,
    buttons: [
      ['wheel', 'middle-click'],
      ['back', 'back'],
      ['forward', 'forward'],
      ['gesture', 'show-desktop'],
    ],
    minDpi: 400,
    maxDpi: 8000,
    dpi: 1600,
  });
  const travel = makeMouse({
    id: 'travel-mouse',
    model: 'Travel Mouse',
    link: LinkType.BLUETOOTH,
    firmware: '1.4.0',
    battery: 15,
    charging: false,
    buttons: [['wheel', 'middle-click']],
    minDpi: 800,
    maxDpi: 3200,
    dpi: 1200,
  });
  const nearby = structuredClone(performance);
  nearby.device = {
    ...nearby.device,
    id: 'performance-mouse-secondary',
    link: LinkType.BLUETOOTH,
    battery: 68,
    charging: false,
    connected: false,
  };
  nearby.settings.deviceId = nearby.device.id;
  return { paired: [performance, travel], available: [nearby] };
}

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
 * Owns the application's devices: the simulated mice, and the real VIA keyboards the
 * native module reports. Pairing and settings of simulated devices are saved; real
 * keyboards keep their own state, which is read again whenever they connect.
 */
export class DeviceState {
  private readonly paired: Entry[];
  private readonly available: Entry[];
  /** Open keyboards by device ID; a disconnected keyboard keeps its entry only. */
  private readonly live = new Map<string, ConnectedKeyboard>();
  private readonly saved: SavedDevices;

  constructor(
    saved: SavedDevices,
    private readonly hooks: DeviceStateHooks,
  ) {
    ({ paired: this.paired, available: this.available } = simulatedDevices());
    this.saved = { pairedIds: saved.pairedIds, settings: { ...saved.settings } };

    if (saved.pairedIds) {
      const pairedIds = new Set(saved.pairedIds);
      for (const entry of [...this.available]) {
        if (pairedIds.has(entry.device.id)) this.move(entry, this.available, this.paired);
      }
      for (const entry of [...this.paired]) {
        if (!pairedIds.has(entry.device.id) && canForget(entry)) {
          this.move(entry, this.paired, this.available);
        }
      }
    } else {
      this.savePairedIds();
    }

    for (const [deviceId, json] of Object.entries(saved.settings)) {
      const entry = this.find(deviceId);
      const settings = Settings.fromJSON(json);
      if (entry && !entry.device.live && isValid(entry, settings)) entry.settings = settings;
    }
  }

  /** Every managed device. */
  list(): DeviceList {
    return { devices: this.paired.map((entry) => entry.device) };
  }

  /** Nearby devices available to pair. */
  discover(): DeviceList {
    return { devices: this.available.map((entry) => entry.device) };
  }

  pair(deviceId: string): void {
    const entry = this.available.find((candidate) => candidate.device.id === deviceId);
    if (!entry) throw new Error(`Cannot pair device: ${deviceId}`);
    this.move(entry, this.available, this.paired);
    this.savePairedIds();
    this.publish();
  }

  forget(deviceId: string): void {
    const entry = this.paired.find((candidate) => candidate.device.id === deviceId);
    if (!entry || !canForget(entry)) throw new Error(`Cannot forget device: ${deviceId}`);
    this.move(entry, this.paired, this.available);
    this.savePairedIds();
    this.publish();
  }

  getSettings(deviceId: string): Settings {
    const entry = this.paired.find((candidate) => candidate.device.id === deviceId);
    if (!entry) throw new Error(`Unknown device: ${deviceId}`);
    return entry.settings;
  }

  /**
   * Validates and applies one complete settings snapshot. A real keyboard's settings
   * change once it acknowledges the write; a simulated device's are saved at once,
   * including an unpaired one, so adding it again does not reset it.
   */
  async applySettings(settings: Settings): Promise<void> {
    const { deviceId } = settings;
    const entry = this.find(deviceId);
    if (!entry || !isValid(entry, settings)) {
      throw new Error(`Cannot apply settings to device: ${deviceId}`);
    }

    if (!entry.device.live) {
      entry.settings = settings;
      this.saved.settings[deviceId] = Settings.toJSON(settings);
      this.hooks.save(this.saved);
      return;
    }

    const keyboard = this.live.get(deviceId);
    if (!keyboard || !settings.keyboard) {
      throw new Error(`Keyboard is not connected: ${deviceId}`);
    }
    // A failed write closes the keyboard; the native module then reports it gone.
    await this.hooks.applyLighting(
      keyboard.connectionId,
      toRawLighting(settings.keyboard, viaModel(keyboard)),
    );
    // Skip results for a keyboard that was unplugged or reopened meanwhile: it has
    // read its lighting again.
    if (this.live.get(deviceId)?.connectionId === keyboard.connectionId) {
      entry.settings = settings;
    }
  }

  /**
   * Matches the complete set of open keyboards to devices, then publishes the change.
   */
  reconcile({ keyboards }: ConnectedKeyboards): void {
    const open = new Set(keyboards.map((keyboard) => keyboard.connectionId));
    let changed = false;

    for (const [deviceId, keyboard] of this.live) {
      if (open.has(keyboard.connectionId)) continue;
      this.live.delete(deviceId);
      const entry = this.find(deviceId)!;
      entry.device = { ...entry.device, connected: false };
      changed = true;
    }

    const known = new Set([...this.live.values()].map((keyboard) => keyboard.connectionId));
    for (const keyboard of keyboards) {
      if (known.has(keyboard.connectionId)) continue;
      this.connect(keyboard);
      changed = true;
    }

    if (changed) this.publish();
  }

  /**
   * A returning keyboard takes the place of the first disconnected unit of its model, so
   * an open device page keeps working. Firmware rarely sets a serial number, so further
   * units of a model are numbered, and identical keyboards may swap IDs on reconnect.
   */
  private connect(keyboard: ConnectedKeyboard): void {
    const modelId = viaModel(keyboard).id;
    const units = this.paired.filter(
      (entry) => entry.device.live && entry.device.modelId === modelId,
    );
    const entry = units.find((unit) => !unit.device.connected);
    let deviceId = entry?.device.id ?? modelId;
    if (!entry && units.length > 0) deviceId += `-${units.length + 1}`;

    // The keyboard restores its own saved lighting when plugged in, so read it again.
    const fresh = viaKeyboard(deviceId, keyboard);
    if (entry) Object.assign(entry, fresh);
    else this.paired.push(fresh);
    this.live.set(deviceId, keyboard);
  }

  private find(deviceId: string): Entry | undefined {
    return [...this.paired, ...this.available].find((entry) => entry.device.id === deviceId);
  }

  private move(entry: Entry, from: Entry[], to: Entry[]): void {
    from.splice(from.indexOf(entry), 1);
    entry.device = { ...entry.device, connected: to === this.paired };
    to.push(entry);
  }

  private savePairedIds(): void {
    this.saved.pairedIds = this.paired.map((entry) => entry.device.id);
    this.hooks.save(this.saved);
  }

  private publish(): void {
    this.hooks.changed(this.list());
  }
}

/** Real keyboards stay listed while plugged in, whatever their link. */
function canForget({ device }: Entry): boolean {
  return device.link !== LinkType.WIRED && !device.live;
}
