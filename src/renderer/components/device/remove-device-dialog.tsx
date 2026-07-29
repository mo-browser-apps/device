import { useState } from 'react';
import { Modal } from '@/components/modal';
import { forgetDevice } from '@/gateway/devices';
import type { Device } from '@/gen/devices';
import { BUTTON_DESTRUCTIVE, BUTTON_OUTLINE } from '@/lib/utils';

export function RemoveDeviceDialog({
  device,
  onClose,
  onRemoved,
}: {
  device: Device;
  onClose: () => void;
  onRemoved?: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setRemoving(true);
    setError(null);
    void forgetDevice(device.id)
      .then(() => {
        onRemoved?.();
        onClose();
      })
      .catch(() => {
        setError(`Could not remove ${device.model}.`);
        setRemoving(false);
      });
  };

  return (
    <Modal
      title={`Remove ${device.model}?`}
      description="It will disappear from MōDevice. You can add it again from the Devices screen."
      role="alertdialog"
      busy={removing}
      onClose={onClose}
      className="w-110"
    >
      <div className="px-6 py-5">
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={removing} className={BUTTON_OUTLINE}>
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className={BUTTON_DESTRUCTIVE}
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
