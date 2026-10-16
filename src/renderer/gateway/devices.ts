import { useCallback, useEffect, useRef, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { Device, Settings } from '@/gen/devices';

/**
 * Requests the devices that the main process currently offers for pairing.
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
 * How often a real device receives previews while a slider moves: 10 times a second,
 * which still looks continuous on the keyboard without flooding IPC and USB. The
 * native module also merges writes that queue up behind a slow keyboard.
 */
const LIVE_PREVIEW_INTERVAL_MS = 100;

/**
 * Loads one device's settings from the main process, and again when it reconnects,
 * since a real keyboard restores its own saved lighting when plugged back in.
 * It previews changes locally and sends committed values back through IPC. A real
 * device also receives previews, throttled, so its lighting follows a moving slider.
 */
export function useDeviceSettings(device: Device) {
  const { id: deviceId, connected, live } = device;
  const [settings, setSettings] = useState<Settings | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);
  const pendingPreview = useRef<Settings | null>(null);
  const lastPreviewAt = useRef(0);

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
  }, [deviceId, connected]);

  useEffect(() => () => window.clearTimeout(previewTimer.current), []);

  const previewSettings = useCallback(
    (nextSettings: Settings) => {
      setSettings(nextSettings);
      if (!live) return;

      // Send the first change at once, then the latest one at most every interval.
      pendingPreview.current = nextSettings;
      if (previewTimer.current !== undefined) return;
      const send = () => {
        previewTimer.current = undefined;
        const pending = pendingPreview.current;
        pendingPreview.current = null;
        if (!pending) return;
        lastPreviewAt.current = performance.now();
        // Failures surface on commit, which sends the final value again.
        void ipc.devices.ApplySettings(pending).catch(() => {});
      };
      const wait = lastPreviewAt.current + LIVE_PREVIEW_INTERVAL_MS - performance.now();
      if (wait <= 0) send();
      else previewTimer.current = window.setTimeout(send, wait);
    },
    [live],
  );

  const commitSettings = useCallback((nextSettings: Settings) => {
    // The committed value replaces any preview still waiting to be sent.
    window.clearTimeout(previewTimer.current);
    previewTimer.current = undefined;
    pendingPreview.current = null;
    setSettings(nextSettings);
    void ipc.devices.ApplySettings(nextSettings).catch((error: unknown) => {
      console.error('Could not apply device settings.', error);
    });
  }, []);

  return { settings, preview: previewSettings, commit: commitSettings };
}
