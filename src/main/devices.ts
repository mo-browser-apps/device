import { ipc, prefs } from '@mobrowser/api';
import { native } from './gen/native';
import type { DeviceList } from './gen/native/devices';
import { DeviceEventsServiceDescriptor } from './gen/native_service';
import { DevicesServiceDescriptor } from './gen/ipc_service';
import { Settings, type DeviceId } from './gen/devices';

const STORED_SETTINGS_KEY = 'devices.settings';

function readStoredSettings(): Record<string, unknown> {
  return prefs.getObject<Record<string, unknown>>(STORED_SETTINGS_KEY, {});
}

function storeSettings(settings: Settings): void {
  prefs.setObject(STORED_SETTINGS_KEY, {
    ...readStoredSettings(),
    [settings.deviceId]: Settings.toJSON(settings),
  });
  if (!prefs.persist()) {
    console.warn('Could not write device settings.');
  }
}

async function restoreSettings(): Promise<void> {
  for (const storedSettings of Object.values(readStoredSettings())) {
    try {
      await native.deviceStack.ApplySettings(Settings.fromJSON(storedSettings));
    } catch (error) {
      console.warn('Could not restore device settings.', error);
    }
  }
}

export function startDevices(): void {
  const deviceUpdates = ipc.registerService(DevicesServiceDescriptor);
  const settingsRestored = restoreSettings();

  ipc.registerService(DevicesServiceDescriptor, {
    async List() {
      return native.deviceStack.List({});
    },
    async GetSettings(request: DeviceId) {
      await settingsRestored;
      return native.deviceStack.GetSettings(request);
    },
    async ApplySettings(request: Settings) {
      await settingsRestored;
      await native.deviceStack.ApplySettings(request);
      storeSettings(request);
      return {};
    },
  });

  native.registerService(DeviceEventsServiceDescriptor, {
    async Changed(devices: DeviceList) {
      deviceUpdates.Watch(devices);
      return {};
    },
  });
}
