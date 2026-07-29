import { cn, FOCUS_RING } from '@/lib/utils';

export function Switch({
  checked,
  labelledBy,
  onChange,
}: {
  checked: boolean;
  labelledBy: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      aria-labelledby={labelledBy}
      onChange={(event) => onChange(event.target.checked)}
      className={cn(
        'relative h-5.5 w-9.5 shrink-0 cursor-pointer appearance-none rounded-full bg-input',
        'transition-colors checked:bg-primary disabled:cursor-default',
        'before:absolute before:left-0.5 before:top-0.5 before:size-4.5 before:rounded-full',
        'before:bg-white before:shadow-sm before:transition-transform',
        'checked:before:translate-x-4',
        FOCUS_RING,
      )}
    />
  );
}
