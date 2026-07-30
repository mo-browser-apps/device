import { useEffect, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { AppSettings } from '@/gen/app';

/**
 * Listens for main-process requests to open a device, such as notification clicks.
 */
export function useOpenDeviceRequests(onOpenDevice: (deviceId: string) => void): void {
  useEffect(() => {
    const subscription = ipc.app.OnOpenDevice({}).subscribe({
      next: ({ id }) => onOpenDevice(id),
      error: (error: unknown) => console.error('Open-device request stream failed.', error),
    });
    return () => subscription.unsubscribe();
  }, [onOpenDevice]);
}

/**
 * Loads app settings from the main process and sends each update back through IPC.
 */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let isActive = true;

    ipc.app
      .GetSettings({})
      .then((storedSettings) => {
        if (isActive) setSettings(storedSettings);
      })
      .catch((error: unknown) => console.error('Could not read app settings.', error));

    return () => {
      isActive = false;
    };
  }, []);

  const updateSettings = (changes: Partial<AppSettings>) => {
    if (!settings) return;

    const nextSettings = { ...settings, ...changes };
    setSettings(nextSettings);
    void ipc.app.ApplySettings(nextSettings).catch((error: unknown) => {
      console.error('Could not apply app settings.', error);
    });
  };

  return { settings, update: updateSettings };
}
