import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { connectionLabel } from '@/components/device-status';
import { Modal } from '@/components/modal';
import { discoverDevices, pairDevice } from '@/gateway/devices';
import type { Device } from '@/gen/devices';
import { BUTTON_PRIMARY } from '@/lib/utils';

interface AddDeviceDialogProps {
  onClose: () => void;
  onPaired: (deviceId: string) => void;
}

/** How often the dialog asks for connected devices while it is open. */
const SEARCH_INTERVAL_MS = 1000;

/**
 * Lists connected devices as they appear and asks the main process to pair the
 * selected one.
 */
export function AddDeviceDialog({
  onClose,
  onPaired,
}: AddDeviceDialogProps) {
  const [nearbyDevices, setNearbyDevices] = useState<Device[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const isPairing = pairingDeviceId !== null;

  useEffect(() => {
    let isActive = true;
    const search = () => {
      void discoverDevices()
        .then((devices) => isActive && setNearbyDevices(devices))
        .catch(() => isActive && setErrorMessage('Could not search for devices.'));
    };
    search();
    const timer = window.setInterval(search, SEARCH_INTERVAL_MS);
    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, []);

  const connectDevice = (device: Device) => {
    setPairingDeviceId(device.id);
    setErrorMessage(null);
    void pairDevice(device.id)
      .then(() => {
        onPaired(device.id);
        onClose();
      })
      .catch(() => setErrorMessage(`Could not add ${device.model}.`))
      .finally(() => setPairingDeviceId(null));
  };

  return (
    <Modal
      title="Add device"
      description="Choose a connected device to add."
      busy={isPairing}
      onClose={onClose}
    >
      <div className="min-h-52 px-6 py-5">
        {nearbyDevices && nearbyDevices.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {nearbyDevices.map((device) => (
              <li
                key={device.id}
                className="flex items-center gap-4 rounded-xl border bg-background/55 px-4 py-3"
              >
                <span className="flex h-18 w-28 shrink-0 items-center justify-center">
                  <DeviceArt device={device} variant="home" className="max-h-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{device.model}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {connectionLabel(device)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => connectDevice(device)}
                  disabled={isPairing}
                  className={BUTTON_PRIMARY}
                >
                  {pairingDeviceId === device.id ? 'Adding…' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <p className="flex items-center gap-2 text-sm font-medium">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              Searching for devices…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Plug in a VIA keyboard or a Razer device, or move a mouse paired with a Logi
              Bolt receiver.
            </p>
          </div>
        )}

        {errorMessage && <p className="mt-4 text-sm text-destructive">{errorMessage}</p>}
      </div>
    </Modal>
  );
}
