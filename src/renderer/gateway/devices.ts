import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { Device, Settings } from '@/gen/devices';

/**
 * The live device list. `Watch` carries only future snapshots, so the current list
 * is fetched separately, and a snapshot arriving during that call wins.
 */
export function useDevices(): { devices: Device[] | null; failed: boolean } {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const subscription = ipc.devices.Watch({}).subscribe({
      next: (list) => setDevices(list.devices),
      error: (error: unknown) => {
        console.error('Device stream failed.', error);
        setFailed(true);
      },
    });

    ipc.devices
      .List({})
      .then((list) => setDevices((current) => current ?? list.devices))
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
    let active = true;

    ipc.devices
      .GetSettings({ id: deviceId })
      .then((stored) => {
        if (active) setSettings(stored);
      })
      .catch((error: unknown) => console.error('Could not read device settings.', error));

    return () => {
      active = false;
    };
  }, [deviceId]);

  const commit = useCallback((next: Settings) => {
    setSettings(next);
    void ipc.devices.ApplySettings(next).catch((error: unknown) => {
      console.error('Could not apply device settings.', error);
    });
  }, []);

  return { settings, preview: setSettings, commit };
}
