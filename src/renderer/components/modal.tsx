import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn, FOCUS_RING } from '@/lib/utils';

interface ModalProps {
  title: ReactNode;
  description: ReactNode;
  role?: 'alertdialog';
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Shows app content in the browser's native dialog layer.
 * It handles focus, Escape, and busy-state closing for its caller.
 */
export function Modal({
  title,
  description,
  role,
  busy,
  onClose,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      className={cn(
        'm-auto w-130 max-w-[calc(100vw-3rem)] rounded-2xl border bg-card p-0 text-card-foreground',
        'shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-6 px-6 py-5">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={requestClose}
          disabled={busy}
          aria-label="Close"
          className={cn(
            'shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40',
            FOCUS_RING,
          )}
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
