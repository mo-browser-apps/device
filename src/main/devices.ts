import { ipc, prefs } from '@mobrowser/api';
import { native } from './gen/native';
import type { ConnectedDevices } from './gen/native/devices';
import { HardwareEventsServiceDescriptor } from './gen/native_service';
import { DevicesServiceDescriptor } from './gen/ipc_service';
import type { DeviceId, DeviceList, Settings } from './gen/devices';
import { DeviceState } from './device-state';
import { checkBatteries, persistPreferences } from './settings';

const STORED_PAIRED_KEY = 'devices.paired';

let state: DeviceState;

/**
 * Returns every device the app currently manages.
 */
export function listDevices(): DeviceList {
  return state.list();
}

/**
 * Restores the paired devices, serves renderer device requests, and keeps the devices in
 * sync with the keyboards and mice the native module reports.
 */
export function startDevices(): void {
  const deviceUpdates = ipc.registerService(DevicesServiceDescriptor);

  state = new DeviceState(
    { paired: prefs.getArray<unknown>(STORED_PAIRED_KEY, []) },
    {
      async applyLighting(connectionId, lighting) {
        await native.hardware.ApplyLighting({ connectionId, lighting });
      },
      async applyDpi(connectionId, dpi) {
        await native.hardware.ApplyDpi({ connectionId, dpi });
      },
      changed(devices) {
        deviceUpdates.Watch(devices);
        checkBatteries(devices);
      },
      save({ paired }) {
        prefs.setArray(STORED_PAIRED_KEY, paired);
        persistPreferences();
      },
    },
  );
  checkBatteries(state.list());

  let notified = false;
  native.registerService(HardwareEventsServiceDescriptor, {
    async Changed(devices: ConnectedDevices) {
      notified = true;
      state.reconcile(devices);
      return {};
    },
  });
  const devicesReady = native.hardware
    .List({})
    // A notification that arrived first carries a newer snapshot.
    .then((devices) => notified || state.reconcile(devices));
  void devicesReady.catch((error: unknown) =>
    console.warn('Could not list connected devices.', error),
  );

  ipc.registerService(DevicesServiceDescriptor, {
    async List() {
      await devicesReady;
      return state.list();
    },
    async Discover() {
      await devicesReady;
      return state.discover();
    },
    async Pair({ id }: DeviceId) {
      await devicesReady;
      state.pair(id);
      return {};
    },
    async Forget({ id }: DeviceId) {
      await devicesReady;
      state.forget(id);
      return {};
    },
    async GetSettings({ id }: DeviceId) {
      await devicesReady;
      return state.getSettings(id);
    },
    async ApplySettings(request: Settings) {
      await devicesReady;
      await state.applySettings(request);
      return {};
    },
  });
}
