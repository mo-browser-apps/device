import type { ReactNode } from 'react';
import type { MouseSettings, MouseSpec, Settings } from '@/gen/devices';
import { MOUSE_LABELS } from '@/components/art/mouse-art';
import { cn } from '@/lib/utils';
import { ACTIONS, boundAction } from './actions';

const DPI_STEP = 100;
const SCROLL_SPEEDS = ['Very slow', 'Slow', 'Medium', 'Fast', 'Very fast'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

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
      <div className="flex items-baseline justify-between gap-3">
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
          '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:shadow-sm',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className={cn(
        'relative h-5.5 w-9.5 shrink-0 cursor-pointer appearance-none rounded-full bg-input',
        'transition-colors checked:bg-primary disabled:cursor-default',
        'before:absolute before:left-0.5 before:top-0.5 before:size-4.5 before:rounded-full',
        // ponytail: knob stays white in both themes, like the macOS switch.
        'before:bg-white before:shadow-sm before:transition-transform',
        'checked:before:translate-x-4',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    />
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
        'flex cursor-pointer items-center gap-3 py-1.5 text-sm',
        'has-disabled:cursor-default',
        selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
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
          'size-3.5 shrink-0 rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
        )}
      />
      {label}
    </label>
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

    const action = boundAction(mouse, selected);
    const rebind = (next: string) =>
      onCommit(
        withMouse({
          bindings: mouse.bindings.map((entry) =>
            entry.control === selected ? { ...entry, action: next } : entry,
          ),
        }),
      );

    const name = MOUSE_LABELS[selected] ?? selected;
    return (
      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
        <legend className="sr-only">{name} action</legend>
        <Section title={name}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(ACTIONS).map(([id, label]) => (
              <ActionOption
                key={id}
                action={id}
                label={label}
                selected={id === action}
                onSelect={() => rebind(id)}
              />
            ))}
          </div>
        </Section>
      </fieldset>
    );
  }

  const commitPreviewed = () => onCommit(settings);

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-10 disabled:opacity-50">
      <Section title="Pointer">
        <Slider
          label="Speed"
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
      </Section>

      <Section title="Scrolling">
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

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Reverse direction</span>
          <Switch
            checked={mouse.naturalScroll}
            onChange={(naturalScroll) => onCommit(withMouse({ naturalScroll }))}
          />
        </div>
      </Section>
    </fieldset>
  );
}
