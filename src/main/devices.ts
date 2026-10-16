import { ipc, prefs } from '@mobrowser/api';
import { native } from './gen/native';
import type { ConnectedKeyboards } from './gen/native/devices';
import { ViaEventsServiceDescriptor } from './gen/native_service';
import { DevicesServiceDescriptor } from './gen/ipc_service';
import type { DeviceId, DeviceList, Settings } from './gen/devices';
import { DeviceState } from './device-state';
import { checkBatteries, persistPreferences } from './settings';

const STORED_SETTINGS_KEY = 'devices.settings';
const STORED_PAIRED_IDS_KEY = 'devices.pairedIds';

let state: DeviceState;

/**
 * Returns every device the app currently manages.
 */
export function listDevices(): DeviceList {
  return state.list();
}

/**
 * Restores the saved devices, serves renderer device requests, and keeps the devices in
 * sync with the VIA keyboards the native module reports.
 */
export function startDevices(): void {
  const deviceUpdates = ipc.registerService(DevicesServiceDescriptor);

  state = new DeviceState(
    {
      pairedIds: prefs.hasArray(STORED_PAIRED_IDS_KEY)
        ? prefs.getArray<string>(STORED_PAIRED_IDS_KEY, [])
        : undefined,
      settings: prefs.getObject<Record<string, unknown>>(STORED_SETTINGS_KEY, {}),
    },
    {
      async applyLighting(connectionId, lighting) {
        await native.via.ApplyLighting({ connectionId, lighting });
      },
      changed(devices) {
        deviceUpdates.Watch(devices);
        checkBatteries(devices);
      },
      save({ pairedIds, settings }) {
        prefs.setArray(STORED_PAIRED_IDS_KEY, pairedIds ?? []);
        prefs.setObject(STORED_SETTINGS_KEY, settings);
        persistPreferences();
      },
    },
  );
  checkBatteries(state.list());

  ipc.registerService(DevicesServiceDescriptor, {
    async List() {
      return state.list();
    },
    async Discover() {
      return state.discover();
    },
    async Pair({ id }: DeviceId) {
      state.pair(id);
      return {};
    },
    async Forget({ id }: DeviceId) {
      state.forget(id);
      return {};
    },
    async GetSettings({ id }: DeviceId) {
      return state.getSettings(id);
    },
    async ApplySettings(request: Settings) {
      await state.applySettings(request);
      return {};
    },
  });

  let notified = false;
  native.registerService(ViaEventsServiceDescriptor, {
    async Changed(keyboards: ConnectedKeyboards) {
      notified = true;
      state.reconcile(keyboards);
      return {};
    },
  });
  native.via
    .List({})
    // A notification that arrived first carries a newer snapshot.
    .then((keyboards) => notified || state.reconcile(keyboards))
    .catch((error: unknown) => console.warn('Could not list VIA keyboards.', error));
}
