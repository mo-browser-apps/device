import { useEffect, useState } from 'react';
import { LoaderCircle, RotateCw } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { connectionLabel } from '@/components/device-status';
import { Modal } from '@/components/modal';
import { discoverDevices, pairDevice } from '@/gateway/devices';
import type { Device } from '@/gen/devices';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, cn } from '@/lib/utils';

interface AddDeviceDialogProps {
  onClose: () => void;
  onPaired: (deviceId: string) => void;
}

export function AddDeviceDialog({
  onClose,
  onPaired,
}: AddDeviceDialogProps) {
  const [nearbyDevices, setNearbyDevices] = useState<Device[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const isPairing = pairingDeviceId !== null;

  const loadNearbyDevices = () => {
    void discoverDevices()
      .then(setNearbyDevices)
      .catch(() => {
        setNearbyDevices([]);
        setErrorMessage('Could not search for devices.');
      });
  };

  useEffect(loadNearbyDevices, []);

  const searchAgain = () => {
    setNearbyDevices(null);
    setErrorMessage(null);
    loadNearbyDevices();
  };

  const connectDevice = (device: Device) => {
    setPairingDeviceId(device.id);
    setErrorMessage(null);
    void pairDevice(device.id)
      .then(() => {
        onPaired(device.id);
        onClose();
      })
      .catch(() => setErrorMessage(`Could not connect ${device.model}.`))
      .finally(() => setPairingDeviceId(null));
  };

  return (
    <Modal
      title="Add device"
      description="Choose a nearby device to connect."
      busy={isPairing}
      onClose={onClose}
    >
      <div className="min-h-52 px-6 py-5">
        {nearbyDevices === null ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            Searching for devices…
          </div>
        ) : nearbyDevices.length > 0 ? (
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
                  {pairingDeviceId === device.id ? 'Connecting…' : 'Connect'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">No devices found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure the device is ready to connect.
            </p>
            <button
              type="button"
              onClick={searchAgain}
              className={cn(BUTTON_OUTLINE, 'mt-4 text-muted-foreground hover:text-foreground')}
            >
              <RotateCw className="size-3.5" />
              Search again
            </button>
          </div>
        )}

        {errorMessage && <p className="mt-4 text-sm text-destructive">{errorMessage}</p>}
      </div>
    </Modal>
  );
}
