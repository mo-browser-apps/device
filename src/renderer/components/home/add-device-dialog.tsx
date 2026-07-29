import { useEffect, useState } from 'react';
import { LoaderCircle, RotateCw } from 'lucide-react';
import { DeviceArt } from '@/components/art/device-art';
import { connectionLabel } from '@/components/device-status';
import { Modal } from '@/components/modal';
import { discoverDevices, pairDevice } from '@/gateway/devices';
import type { Device } from '@/gen/devices';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, cn } from '@/lib/utils';

export function AddDeviceDialog({
  onClose,
  onPaired,
}: {
  onClose: () => void;
  onPaired: (deviceId: string) => void;
}) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);

  const discover = () => {
    void discoverDevices()
      .then(setDevices)
      .catch(() => {
        setDevices([]);
        setError('Could not search for devices.');
      });
  };

  useEffect(discover, []);

  const pair = (device: Device) => {
    setPairing(device.id);
    setError(null);
    void pairDevice(device.id)
      .then(() => {
        onPaired(device.id);
        onClose();
      })
      .catch(() => setError(`Could not connect ${device.model}.`))
      .finally(() => setPairing(null));
  };

  return (
    <Modal
      title="Add device"
      description="Choose a nearby device to connect."
      busy={Boolean(pairing)}
      onClose={onClose}
    >
      <div className="min-h-52 px-6 py-5">
        {devices === null ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            Searching for devices…
          </div>
        ) : devices.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {devices.map((device) => (
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
                  onClick={() => pair(device)}
                  disabled={Boolean(pairing)}
                  className={BUTTON_PRIMARY}
                >
                  {pairing === device.id ? 'Connecting…' : 'Connect'}
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
              onClick={() => {
                setDevices(null);
                setError(null);
                discover();
              }}
              className={cn(BUTTON_OUTLINE, 'mt-4 text-muted-foreground hover:text-foreground')}
            >
              <RotateCw className="size-3.5" />
              Search again
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
