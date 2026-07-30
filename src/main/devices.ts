import { ipc, prefs } from '@mobrowser/api';
import { native } from './gen/native';
import {
  LinkType as NativeLinkType,
  type DeviceList as NativeDeviceList,
} from './gen/native/devices';
import { DeviceEventsServiceDescriptor } from './gen/native_service';
import { DevicesServiceDescriptor } from './gen/ipc_service';
import { Settings as IpcSettings, type DeviceId } from './gen/devices';
import { checkBatteries, persistPreferences } from './settings';

const STORED_SETTINGS_KEY = 'devices.settings';
const STORED_PAIRED_IDS_KEY = 'devices.pairedIds';

/**
 * Reads every saved device-settings snapshot from main-process preferences.
 */
function readStoredSettings(): Record<string, unknown> {
  return prefs.getObject<Record<string, unknown>>(STORED_SETTINGS_KEY, {});
}

/**
 * Saves one device's complete settings snapshot without changing the others.
 */
function storeSettings(settings: IpcSettings): void {
  prefs.setObject(STORED_SETTINGS_KEY, {
    ...readStoredSettings(),
    [settings.deviceId]: IpcSettings.toJSON(settings),
  });
  persistPreferences();
}

/**
 * Saves the IDs of devices currently managed by the native device stack.
 */
function storePairedDevices(devices: NativeDeviceList): void {
  prefs.setArray(
    STORED_PAIRED_IDS_KEY,
    devices.devices.map((device) => device.id),
  );
  persistPreferences();
}

/**
 * Makes the native paired-device list match the IDs saved by the main process.
 */
async function restorePairedDevices(): Promise<void> {
  const paired = await native.deviceStack.List({});
  if (!prefs.hasArray(STORED_PAIRED_IDS_KEY)) {
    storePairedDevices(paired);
    return;
  }

  const storedIds = new Set(prefs.getArray<string>(STORED_PAIRED_IDS_KEY, []));
  const available = await native.deviceStack.Discover({});

  for (const device of available.devices) {
    if (storedIds.has(device.id)) {
      await native.deviceStack.Pair({ id: device.id });
    }
  }
  for (const device of paired.devices) {
    if (!storedIds.has(device.id) && device.link !== NativeLinkType.WIRED) {
      await native.deviceStack.Forget({ id: device.id });
    }
  }

  storePairedDevices(await native.deviceStack.List({}));
}

/**
 * Sends saved settings back to the native device stack when the app starts.
 */
async function restoreSettings(): Promise<void> {
  for (const storedSettings of Object.values(readStoredSettings())) {
    try {
      await native.deviceStack.ApplySettings(IpcSettings.fromJSON(storedSettings));
    } catch (error) {
      console.warn('Could not restore device settings.', error);
    }
  }
}

/**
 * Connects renderer device requests to the native stack and keeps both sides in sync.
 */
export function startDevices(): void {
  const deviceUpdates = ipc.registerService(DevicesServiceDescriptor);
  const devicesReady = restorePairedDevices().then(restoreSettings);

  let restored = false;
  void devicesReady
    .then(async () => {
      restored = true;
      checkBatteries(await native.deviceStack.List({}));
    })
    .catch((error: unknown) => console.warn('Could not check device batteries.', error));

  ipc.registerService(DevicesServiceDescriptor, {
    async List() {
      await devicesReady;
      return native.deviceStack.List({});
    },
    async Discover() {
      await devicesReady;
      return native.deviceStack.Discover({});
    },
    async Pair(request: DeviceId) {
      await devicesReady;
      await native.deviceStack.Pair(request);
      storePairedDevices(await native.deviceStack.List({}));
      return {};
    },
    async Forget(request: DeviceId) {
      await devicesReady;
      await native.deviceStack.Forget(request);
      storePairedDevices(await native.deviceStack.List({}));
      return {};
    },
    async GetSettings(request: DeviceId) {
      await devicesReady;
      return native.deviceStack.GetSettings(request);
    },
    async ApplySettings(request: IpcSettings) {
      await devicesReady;
      await native.deviceStack.ApplySettings(request);
      storeSettings(request);
      return {};
    },
  });

  native.registerService(DeviceEventsServiceDescriptor, {
    async Changed(devices: NativeDeviceList) {
      deviceUpdates.Watch(devices);
      if (restored) checkBatteries(devices);
      return {};
    },
  });
}
