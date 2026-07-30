import { useState } from 'react';
import { Modal } from '@/components/modal';
import { forgetDevice } from '@/gateway/devices';
import type { Device } from '@/gen/devices';
import { BUTTON_DESTRUCTIVE, BUTTON_OUTLINE } from '@/lib/utils';

interface RemoveDeviceDialogProps {
  device: Device;
  onClose: () => void;
  onRemoved?: () => void;
}

export function RemoveDeviceDialog({ device, onClose, onRemoved }: RemoveDeviceDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const removeDevice = () => {
    setIsRemoving(true);
    setErrorMessage(null);
    void forgetDevice(device.id)
      .then(() => {
        onRemoved?.();
        onClose();
      })
      .catch(() => {
        setErrorMessage(`Could not remove ${device.model}.`);
        setIsRemoving(false);
      });
  };

  return (
    <Modal
      title={`Remove ${device.model}?`}
      description="It will disappear from MōDevice. You can add it again from the Devices screen."
      role="alertdialog"
      busy={isRemoving}
      onClose={onClose}
      className="w-110"
    >
      <div className="px-6 py-5">
        {errorMessage && <p className="mb-4 text-sm text-destructive">{errorMessage}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isRemoving} className={BUTTON_OUTLINE}>
            Cancel
          </button>
          <button
            type="button"
            onClick={removeDevice}
            disabled={isRemoving}
            className={BUTTON_DESTRUCTIVE}
          >
            {isRemoving ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
