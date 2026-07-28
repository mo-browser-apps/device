import { useEffect, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { Device } from '@/gen/devices';

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
