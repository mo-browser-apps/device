import { useEffect, useState } from 'react';
import { ipc } from '@/gen/ipc';
import type { AppSettings } from '@/gen/app';

/** Fires when the user clicks a device notification. */
export function useOpenDeviceRequests(onRequest: (deviceId: string) => void): void {
  useEffect(() => {
    const subscription = ipc.app.OnOpenDevice({}).subscribe({
      next: ({ id }) => onRequest(id),
      error: (error: unknown) => console.error('Device request stream failed.', error),
    });
    return () => subscription.unsubscribe();
  }, [onRequest]);
}

/** Application settings, owned by the main process. `update` applies at once. */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let active = true;

    ipc.app
      .GetSettings({})
      .then((stored) => {
        if (active) setSettings(stored);
      })
      .catch((error: unknown) => console.error('Could not read app settings.', error));

    return () => {
      active = false;
    };
  }, []);

  const update = (changes: Partial<AppSettings>) => {
    if (!settings) return;

    const next = { ...settings, ...changes };
    setSettings(next);
    void ipc.app.ApplySettings(next).catch((error: unknown) => {
      console.error('Could not apply app settings.', error);
    });
  };

  return { settings, update };
}
