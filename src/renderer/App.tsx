import { useCallback, useEffect, useRef, useState } from 'react';
import { Home } from '@/components/home/home';
import { DeviceView } from '@/components/device/device-view';
import { SettingsView } from '@/components/settings/settings-view';
import { useDevices } from '@/gateway/devices';
import { useAppSettings, useOpenDeviceRequests } from '@/gateway/settings';

const isMac = navigator.userAgent.includes('Mac');

export default function App() {
  const { devices, failed } = useDevices();
  const { settings, update } = useAppSettings();
  /** Either fixed screen, or the id of the device being configured. */
  const [screen, setScreen] = useState('devices');
  const [homeState, setHomeState] = useState<{ scrollLeft: number; focusId: string | null }>({
    scrollLeft: 0,
    focusId: null,
  });
  const mainRef = useRef<HTMLElement>(null);
  const restoreHomeFocus = useRef(false);

  const openDevice = devices?.find((device) => device.id === screen) ?? null;

  const theme = settings?.theme ?? 'system';
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolved);
    };

    apply();
    if (theme !== 'system') return;

    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useOpenDeviceRequests(useCallback((deviceId: string) => setScreen(deviceId), []));

  useEffect(() => {
    if (screen === 'devices' && restoreHomeFocus.current) {
      restoreHomeFocus.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [screen]);

  const backToDevices = () => {
    restoreHomeFocus.current = true;
    setScreen('devices');
  };

  return (
    <div className="flex h-screen flex-col">
      {isMac && <div className="draggable h-7 shrink-0" />}
      <main ref={mainRef} tabIndex={-1} className="flex-1 overflow-hidden pt-6 outline-hidden">
        {failed && (
          <p className="mx-auto max-w-3xl px-8 pb-4 text-sm text-destructive">
            Lost contact with the device service. Restart the app to reconnect.
          </p>
        )}
        {devices !== null && (
          <div
            key={screen}
            className="h-full animate-in fade-in duration-200 motion-reduce:animate-none"
          >
            {screen === 'settings' ? (
              <SettingsView settings={settings} update={update} onBack={backToDevices} />
            ) : openDevice ? (
              <DeviceView
                device={openDevice}
                onRemoved={() => {
                  setHomeState((current) => ({ ...current, focusId: null }));
                  setScreen('devices');
                }}
                onBack={backToDevices}
              />
            ) : (
              <Home
                devices={devices}
                initialScrollLeft={homeState.scrollLeft}
                restoreFocusId={homeState.focusId}
                onOpen={(deviceId, scrollLeft) => {
                  setHomeState({ scrollLeft, focusId: deviceId });
                  setScreen(deviceId);
                }}
                onOpenSettings={() => setScreen('settings')}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
