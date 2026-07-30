import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, type HomeFocusTarget } from '@/components/home/home';
import { DeviceView } from '@/components/device/device-view';
import { SettingsView } from '@/components/settings/settings-view';
import { useDevices } from '@/gateway/devices';
import { useAppSettings, useOpenDeviceRequests } from '@/gateway/settings';

const isMac = navigator.userAgent.includes('Mac');

interface HomeState {
  scrollLeft: number;
  focus: HomeFocusTarget;
}

export default function App() {
  const { devices, failed } = useDevices();
  const { settings, update } = useAppSettings();

  const [screen, setScreen] = useState('devices');
  const [homeState, setHomeState] = useState<HomeState>({
    scrollLeft: 0,
    focus: null,
  });

  const mainRef = useRef<HTMLElement>(null);
  const restoreHomeFocus = useRef(false);

  const activeDevice = devices?.find((device) => device.id === screen) ?? null;

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

  const openDevice = useCallback((deviceId: string, scrollLeft?: number) => {
    setHomeState((current) => ({
      scrollLeft: scrollLeft ?? current.scrollLeft,
      focus: { type: 'device', id: deviceId },
    }));
    setScreen(deviceId);
  }, []);

  useOpenDeviceRequests(openDevice);

  useEffect(() => {
    if (screen === 'devices' && restoreHomeFocus.current) {
      restoreHomeFocus.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [screen]);

  const openSettings = (scrollLeft: number) => {
    setHomeState({ scrollLeft, focus: { type: 'settings' } });
    setScreen('settings');
  };

  const backToDevices = () => {
    restoreHomeFocus.current = true;
    setScreen('devices');
  };

  const handleDeviceRemoved = () => {
    setHomeState((current) => ({ ...current, focus: null }));
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
            ) : activeDevice ? (
              <DeviceView
                device={activeDevice}
                onRemoved={handleDeviceRemoved}
                onBack={backToDevices}
              />
            ) : (
              <Home
                devices={devices}
                initialScrollLeft={homeState.scrollLeft}
                restoreFocus={homeState.focus}
                onOpen={openDevice}
                onOpenSettings={openSettings}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
