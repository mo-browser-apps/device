import type { MouseSettings, Settings } from '@/gen/devices';
import { MOUSE_LABELS } from '@/components/art/mouse-art';
import { cn } from '@/lib/utils';
import { ACTIONS, actionLabel } from './actions';

const DPI_STEP = 100;
const MIN_SCROLL_SPEED = 1;
const MAX_SCROLL_SPEED = 5;
const SCROLL_SPEED_LABELS = ['Very slow', 'Slow', 'Balanced', 'Fast', 'Very fast'];

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  description,
  disabled,
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
  description?: string;
  disabled: boolean;
  onPreview: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="space-y-3">
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
        disabled={disabled}
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
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      {description && (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 has-disabled:cursor-default has-disabled:opacity-50">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
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

function ActionList({
  action,
  disabled,
  onChange,
}: {
  action: string;
  disabled: boolean;
  onChange: (action: string) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">Button action</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {ACTIONS.map((candidate) => (
          <label
            key={candidate}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
              'transition-colors has-disabled:cursor-default has-disabled:opacity-50',
              candidate === action
                ? 'border-primary/70 bg-primary/10'
                : 'border-transparent hover:bg-accent',
            )}
          >
            <input
              type="radio"
              name="action"
              value={candidate}
              checked={candidate === action}
              disabled={disabled}
              onChange={() => onChange(candidate)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                'size-3 shrink-0 rounded-full border',
                candidate === action ? 'border-primary bg-primary' : 'border-input',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
              )}
            />
            {actionLabel(candidate)}
          </label>
        ))}
      </div>
      <div className="mt-3 border-t border-border/60 pt-3">
        <label
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
            'transition-colors has-disabled:cursor-default has-disabled:opacity-50',
            action === 'disabled'
              ? 'border-primary/70 bg-primary/10'
              : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <input
            type="radio"
            name="action"
            value="disabled"
            checked={action === 'disabled'}
            disabled={disabled}
            onChange={() => onChange('disabled')}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              'size-3 shrink-0 rounded-full border',
              action === 'disabled' ? 'border-primary bg-primary' : 'border-input',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
              'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            )}
          />
          Disable button
        </label>
      </div>
    </fieldset>
  );
}

export function ControlEditor({
  settings,
  mouse,
  minDpi,
  maxDpi,
  selected,
  segment,
  disabled,
  onPreview,
  onCommit,
}: {
  settings: Settings;
  mouse: MouseSettings;
  minDpi: number;
  maxDpi: number;
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

    const binding = mouse.bindings.find((entry) => entry.control === selected);
    return (
      <div className="rounded-xl border border-border/70 bg-card/45 p-4">
        <h2 className="mb-4 text-sm font-medium">{MOUSE_LABELS[selected] ?? selected}</h2>
        <ActionList
          action={binding?.action ?? ''}
          disabled={disabled}
          onChange={(action) =>
            onCommit(
              withMouse({
                bindings: mouse.bindings.map((entry) =>
                  entry.control === selected ? { ...entry, action } : entry,
                ),
              }),
            )
          }
        />
      </div>
    );
  }

  const scrollSpeedIndex =
    Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, mouse.scrollSpeed)) - MIN_SCROLL_SPEED;
  const scrollSpeed = SCROLL_SPEED_LABELS[scrollSpeedIndex];

  return (
    <div className="rounded-xl border border-border/70 bg-card/45 p-4">
      <div className="space-y-5">
        <Slider
          label="Pointer speed"
          value={mouse.dpi}
          display={`${mouse.dpi} DPI`}
          min={minDpi}
          max={maxDpi}
          step={DPI_STEP}
          minLabel={`${minDpi} DPI`}
          maxLabel={`${maxDpi} DPI`}
          description="Higher values move the pointer farther with less hand movement."
          disabled={disabled}
          onPreview={(dpi) => onPreview(withMouse({ dpi }))}
          onCommit={() => onCommit(settings)}
        />
        <div className="border-t border-border/60 pt-5">
          <Slider
            label="Wheel speed"
            value={mouse.scrollSpeed}
            display={scrollSpeed}
            min={MIN_SCROLL_SPEED}
            max={MAX_SCROLL_SPEED}
            step={1}
            minLabel="Slower"
            maxLabel="Faster"
            disabled={disabled}
            onPreview={(scrollSpeed) => onPreview(withMouse({ scrollSpeed }))}
            onCommit={() => onCommit(settings)}
          />
        </div>
        <div className="border-t border-border/60 pt-5">
          <Switch
            label="Reverse wheel direction"
            checked={mouse.naturalScroll}
            disabled={disabled}
            onChange={(naturalScroll) => onCommit(withMouse({ naturalScroll }))}
          />
        </div>
      </div>
    </div>
  );
}
