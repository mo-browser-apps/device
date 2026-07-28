import { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Home } from '@/components/home';
import { DeviceView } from '@/components/device/device-view';
import { useDevices } from '@/gateway/devices';

const isMac = navigator.userAgent.includes('Mac');

export default function App() {
  const { devices, failed } = useDevices();
  const [openId, setOpenId] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<{ scrollLeft: number; focusId: string | null }>({
    scrollLeft: 0,
    focusId: null,
  });
  const mainRef = useRef<HTMLElement>(null);
  const restoreHomeFocus = useRef(false);

  const openDevice = devices?.find((device) => device.id === openId) ?? null;
  const screenKey = openDevice?.id ?? 'devices';

  if (openId !== null && devices !== null && openDevice === null) {
    setOpenId(null);
  }

  useEffect(() => {
    if (screenKey === 'devices' && restoreHomeFocus.current) {
      restoreHomeFocus.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [screenKey]);

  return (
    <ThemeProvider>
      <div className="flex h-screen flex-col">
        {isMac && <div className="draggable h-7 shrink-0" />}
        <main ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto pt-6 outline-hidden">
          {failed && (
            <p className="mx-auto max-w-3xl px-8 pb-4 text-sm text-destructive">
              Lost contact with the device service. Restart the app to reconnect.
            </p>
          )}
          {devices !== null &&
            (openDevice ? (
              <DeviceView
                key={openDevice.id}
                device={openDevice}
                onBack={() => {
                  restoreHomeFocus.current = true;
                  setOpenId(null);
                }}
              />
            ) : (
              <Home
                devices={devices}
                initialScrollLeft={homeState.scrollLeft}
                restoreFocusId={homeState.focusId}
                onOpen={(deviceId, scrollLeft) => {
                  setHomeState({ scrollLeft, focusId: deviceId });
                  setOpenId(deviceId);
                }}
              />
            ))}
        </main>
      </div>
    </ThemeProvider>
  );
}
