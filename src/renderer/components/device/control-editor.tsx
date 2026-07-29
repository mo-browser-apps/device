import type { CSSProperties, ReactNode } from 'react';
import type {
  Binding,
  Device,
  KeyboardSettings,
  MouseSettings,
  MouseSpec,
  Settings,
} from '@/gen/devices';
import { connectionLabel } from '@/components/device-status';
import { cn, FOCUS_RING } from '@/lib/utils';
import {
  EFFECTS,
  KEY_ACTIONS,
  MOUSE_ACTIONS,
  actionLabel,
  boundAction,
  controlLabel,
} from './controls';

export type Segment = 'buttons' | 'movement' | 'keys' | 'lighting' | 'info';

const DPI_STEP = 100;
const SCROLL_SPEEDS = ['Very slow', 'Slow', 'Medium', 'Fast', 'Very fast'];

/** The hue slider's own track, the one place colour is allowed outside the art. */
const HUE_TRACK: CSSProperties = {
  background: `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360]
    .map((hue) => `hsl(${hue} 95% 55%)`)
    .join(', ')})`,
};

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
  trackStyle,
  onPreview,
  onCommit,
}: {
  label: string;
  display: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
  description?: string;
  trackStyle?: CSSProperties;
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
        style={trackStyle}
        onChange={(event) => onPreview(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className={cn(
          'h-1 w-full cursor-pointer appearance-none rounded-full bg-input',
          '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:shadow-sm',
          FOCUS_RING,
        )}
      />
      {minLabel && maxLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
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
        'before:bg-white before:shadow-sm before:transition-transform',
        'checked:before:translate-x-4',
        FOCUS_RING,
      )}
    />
  );
}

function RadioOption({
  group,
  value,
  label,
  selected,
  onSelect,
}: {
  group: string;
  value: string;
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
        name={group}
        value={value}
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

/** Buttons and Keys differ only in which actions they offer. */
function BindingEditor({
  control,
  bindings,
  actions,
  disabled,
  onRebind,
}: {
  control: string;
  bindings: Binding[];
  actions: string[];
  disabled: boolean;
  onRebind: (bindings: Binding[]) => void;
}) {
  const name = controlLabel(control);
  const current = boundAction(bindings, control);

  const rebind = (action: string) =>
    onRebind(bindings.map((entry) => (entry.control === control ? { ...entry, action } : entry)));

  return (
    <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
      <legend className="sr-only">{name} action</legend>
      <Section title={name}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {actions.map((action) => (
            <RadioOption
              key={action}
              group="action"
              value={action}
              label={actionLabel(action)}
              selected={action === current}
              onSelect={() => rebind(action)}
            />
          ))}
        </div>
      </Section>
    </fieldset>
  );
}

function Info({ device }: { device: Device }) {
  const rows: [string, string][] = [
    ['Connection', connectionLabel(device)],
    ['Firmware', device.firmware],
  ];

  if (device.keyboard) {
    rows.push(
      ['Remappable keys', String(device.keyboard.keys.length)],
      ['Lighting', device.keyboard.backlight ? 'Supported' : 'Not supported'],
    );
  }
  if (device.mouse) {
    rows.push(
      ['Remappable buttons', String(device.mouse.buttons.length)],
      ['Sensor', `${device.mouse.minDpi}–${device.mouse.maxDpi} DPI`],
    );
  }

  return (
    <Section title="Info">
      <dl className="flex flex-col gap-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function MouseEditor({
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

    return (
      <BindingEditor
        control={selected}
        bindings={mouse.bindings}
        actions={MOUSE_ACTIONS}
        disabled={disabled}
        onRebind={(bindings) => onCommit(withMouse({ bindings }))}
      />
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

function KeyboardEditor({
  settings,
  keyboard,
  selected,
  segment,
  disabled,
  onPreview,
  onCommit,
}: {
  settings: Settings;
  keyboard: KeyboardSettings;
  selected: string | null;
  segment: 'keys' | 'lighting';
  disabled: boolean;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}) {
  const withKeyboard = (changes: Partial<KeyboardSettings>): Settings => ({
    ...settings,
    keyboard: { ...keyboard, ...changes },
  });

  if (segment === 'keys') {
    if (!selected) return null;

    return (
      <BindingEditor
        control={selected}
        bindings={keyboard.bindings}
        actions={KEY_ACTIONS}
        disabled={disabled}
        onRebind={(bindings) => onCommit(withKeyboard({ bindings }))}
      />
    );
  }

  const commitPreviewed = () => onCommit(settings);

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-10 disabled:opacity-50">
      <Section title="Effect">
        <div className="flex flex-col">
          {EFFECTS.map(([effect, label]) => (
            <RadioOption
              key={effect}
              group="effect"
              value={String(effect)}
              label={label}
              selected={effect === keyboard.effect}
              onSelect={() => onCommit(withKeyboard({ effect }))}
            />
          ))}
        </div>
      </Section>

      <Section title="Colour">
        <Slider
          label="Hue"
          display={
            <span
              aria-hidden="true"
              className="inline-block size-3.5 rounded-full border border-border/60 align-middle"
              style={{ background: `hsl(${keyboard.hue} 95% 55%)` }}
            />
          }
          value={keyboard.hue}
          min={0}
          max={359}
          step={1}
          trackStyle={HUE_TRACK}
          onPreview={(hue) => onPreview(withKeyboard({ hue }))}
          onCommit={commitPreviewed}
        />
      </Section>

      <Section title="Brightness">
        <Slider
          label="Level"
          display={`${keyboard.brightness}%`}
          value={keyboard.brightness}
          min={0}
          max={100}
          step={1}
          minLabel="Off"
          maxLabel="Bright"
          onPreview={(brightness) => onPreview(withKeyboard({ brightness }))}
          onCommit={commitPreviewed}
        />
      </Section>
    </fieldset>
  );
}

export function ControlEditor({
  device,
  settings,
  selected,
  segment,
  disabled,
  onPreview,
  onCommit,
}: {
  device: Device;
  settings: Settings;
  selected: string | null;
  segment: Segment;
  disabled: boolean;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}) {
  if (segment === 'info') {
    return <Info device={device} />;
  }

  if (segment === 'keys' || segment === 'lighting') {
    if (!settings.keyboard) return null;
    return (
      <KeyboardEditor
        settings={settings}
        keyboard={settings.keyboard}
        selected={selected}
        segment={segment}
        disabled={disabled}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    );
  }

  if (!settings.mouse || !device.mouse) return null;
  return (
    <MouseEditor
      settings={settings}
      mouse={settings.mouse}
      spec={device.mouse}
      selected={selected}
      segment={segment}
      disabled={disabled}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  );
}
