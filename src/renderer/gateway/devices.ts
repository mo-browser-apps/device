import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { Device, Settings } from '@/gen/devices';

export async function discoverDevices(): Promise<Device[]> {
  return (await ipc.devices.Discover({})).devices;
}

export async function pairDevice(deviceId: string): Promise<void> {
  await ipc.devices.Pair({ id: deviceId });
}

export async function forgetDevice(deviceId: string): Promise<void> {
  await ipc.devices.Forget({ id: deviceId });
}

/**
 * The live device list. `Watch` carries only future snapshots, so the current list
 * is fetched separately, and a snapshot arriving during that call wins.
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
 * Settings for one device. `preview` updates local state, while `commit` sends the
 * settings to the device service for application and persistence.
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
