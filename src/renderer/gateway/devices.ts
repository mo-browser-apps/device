import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { Device, Settings } from '@/gen/devices';

/**
 * Requests the devices that the native stack currently offers for pairing.
 */
export async function discoverDevices(): Promise<Device[]> {
  return (await ipc.devices.Discover({})).devices;
}

/**
 * Asks the main process to add one discovered device.
 */
export async function pairDevice(deviceId: string): Promise<void> {
  await ipc.devices.Pair({ id: deviceId });
}

/**
 * Asks the main process to remove one managed device.
 */
export async function forgetDevice(deviceId: string): Promise<void> {
  await ipc.devices.Forget({ id: deviceId });
}

/**
 * Keeps the renderer's device list in sync with complete snapshots from the main process.
 * It loads the current list first, then listens for later changes.
 */
export function useDevices(): { devices: Device[] | null; failed: boolean } {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const subscription = ipc.devices.Watch({}).subscribe({
      next: (deviceList) => setDevices(deviceList.devices),
      error: (error: unknown) => {
        console.error('Device stream failed.', error);
        setFailed(true);
      },
    });

    ipc.devices
      .List({})
      .then((deviceList) =>
        setDevices((currentDevices) => currentDevices ?? deviceList.devices),
      )
      .catch((error: unknown) => {
        console.error('Could not list devices.', error);
        setFailed(true);
      });

    return () => subscription.unsubscribe();
  }, []);

  return { devices, failed };
}

/**
 * Loads one device's settings from the main process.
 * It previews changes locally and sends committed values back through IPC.
 */
export function useDeviceSettings(deviceId: string) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let isActive = true;

    ipc.devices
      .GetSettings({ id: deviceId })
      .then((storedSettings) => {
        if (isActive) setSettings(storedSettings);
      })
      .catch((error: unknown) => console.error('Could not read device settings.', error));

    return () => {
      isActive = false;
    };
  }, [deviceId]);

  const commitSettings = useCallback((nextSettings: Settings) => {
    setSettings(nextSettings);
    void ipc.devices.ApplySettings(nextSettings).catch((error: unknown) => {
      console.error('Could not apply device settings.', error);
    });
  }, []);

  return { settings, preview: setSettings, commit: commitSettings };
}
