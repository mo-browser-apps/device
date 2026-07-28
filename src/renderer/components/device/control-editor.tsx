import type { MouseSettings, MouseSpec, Settings } from '@/gen/devices';
import { MOUSE_LABELS } from '@/components/art/mouse-art';
import { cn } from '@/lib/utils';
import { ACTIONS, DISABLED } from './actions';

const DPI_STEP = 100;
const SCROLL_SPEEDS = ['Very slow', 'Slow', 'Balanced', 'Fast', 'Very fast'];
const PANEL = 'min-w-0 rounded-xl border bg-card p-4 shadow-sm';

function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  description,
  onPreview,
  onCommit,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  description?: string;
  onPreview: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground/80">{display}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onPreview(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className={cn(
          'h-1 w-full cursor-pointer appearance-none rounded-full bg-input',
          'disabled:cursor-default disabled:opacity-50',
          '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:shadow-sm',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {description && (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 has-disabled:cursor-default has-disabled:opacity-50">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-input',
          'transition-colors checked:bg-primary disabled:cursor-default',
          'before:absolute before:left-0.5 before:top-0.5 before:size-4 before:rounded-full',
          'before:bg-background before:shadow-sm before:transition-transform',
          'checked:before:translate-x-4',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      />
    </label>
  );
}

function ActionOption({
  action,
  label,
  selected,
  onSelect,
}: {
  action: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
        'transition-colors has-disabled:cursor-default has-disabled:opacity-50',
        selected ? 'border-primary/70 bg-primary/10' : 'border-transparent hover:bg-accent',
      )}
    >
      <input
        type="radio"
        name="action"
        value={action}
        checked={selected}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'size-3 shrink-0 rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
        )}
      />
      {label}
    </label>
  );
}

function ActionList({
  action,
  onChange,
}: {
  action: string;
  onChange: (action: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Button action</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(ACTIONS).map(([id, label]) => (
          <ActionOption
            key={id}
            action={id}
            label={label}
            selected={id === action}
            onSelect={() => onChange(id)}
          />
        ))}
      </div>
      <div className="mt-3 border-t pt-3">
        <ActionOption
          action={DISABLED}
          label="Disable button"
          selected={action === DISABLED}
          onSelect={() => onChange(DISABLED)}
        />
      </div>
    </fieldset>
  );
}

export function ControlEditor({
  settings,
  mouse,
  spec,
  selected,
  segment,
  disabled,
  onPreview,
  onCommit,
}: {
  settings: Settings;
  mouse: MouseSettings;
  spec: MouseSpec;
  selected: string | null;
  segment: 'buttons' | 'movement';
  disabled: boolean;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}) {
  const withMouse = (changes: Partial<MouseSettings>): Settings => ({
    ...settings,
    mouse: { ...mouse, ...changes },
  });

  if (segment === 'buttons') {
    if (!selected) return null;

    const action = mouse.bindings.find((entry) => entry.control === selected)?.action ?? '';
    return (
      <fieldset disabled={disabled} className={PANEL}>
        <h2 className="mb-4 text-sm font-medium">{MOUSE_LABELS[selected] ?? selected}</h2>
        <ActionList
          action={action}
          onChange={(next) =>
            onCommit(
              withMouse({
                bindings: mouse.bindings.map((entry) =>
                  entry.control === selected ? { ...entry, action: next } : entry,
                ),
              }),
            )
          }
        />
      </fieldset>
    );
  }

  // Sliders preview on every change, so `settings` already holds the value to commit.
  const commitPreviewed = () => onCommit(settings);

  return (
    <fieldset disabled={disabled} className={cn(PANEL, 'flex flex-col gap-5')}>
      <Slider
        label="Pointer speed"
        display={`${mouse.dpi} DPI`}
        value={mouse.dpi}
        min={spec.minDpi}
        max={spec.maxDpi}
        step={DPI_STEP}
        minLabel={`${spec.minDpi} DPI`}
        maxLabel={`${spec.maxDpi} DPI`}
        description="Higher values move the pointer farther with less hand movement."
        onPreview={(dpi) => onPreview(withMouse({ dpi }))}
        onCommit={commitPreviewed}
      />
      <div className="border-t pt-5">
        <Slider
          label="Wheel speed"
          display={SCROLL_SPEEDS[mouse.scrollSpeed - 1] ?? `${mouse.scrollSpeed}`}
          value={mouse.scrollSpeed}
          min={1}
          max={SCROLL_SPEEDS.length}
          step={1}
          minLabel="Slower"
          maxLabel="Faster"
          onPreview={(scrollSpeed) => onPreview(withMouse({ scrollSpeed }))}
          onCommit={commitPreviewed}
        />
      </div>
      <div className="border-t pt-5">
        <Switch
          label="Reverse wheel direction"
          checked={mouse.naturalScroll}
          onChange={(naturalScroll) => onCommit(withMouse({ naturalScroll }))}
        />
      </div>
    </fieldset>
  );
}
