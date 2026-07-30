import type { CSSProperties, ReactNode } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
  LinkType,
  type Binding,
  type Device,
  type KeyboardSettings,
  type MouseSettings,
  type MouseSpec,
  type Settings,
} from '@/gen/devices';
import { connectionLabel } from '@/components/device-status';
import { Switch } from '@/components/switch';
import { BUTTON_OUTLINE, cn, FOCUS_RING } from '@/lib/utils';
import {
  EFFECTS,
  KEY_ACTIONS,
  MOUSE_ACTIONS,
  actionLabel,
  boundAction,
  controlLabel,
  resetKeyBindings,
  resetMouseBindings,
} from './controls';

export type Segment = 'buttons' | 'movement' | 'keys' | 'lighting' | 'info';

type SettingsChangeHandler = (settings: Settings) => void;

const DPI_STEP = 100;
const SCROLL_SPEED_LABELS = ['Very slow', 'Slow', 'Medium', 'Fast', 'Very fast'];

/**
 * Draws the color range behind the keyboard hue slider.
 */
const HUE_TRACK_STYLE: CSSProperties = {
  background: `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360]
    .map((hue) => `hsl(${hue} 95% 55%)`)
    .join(', ')})`,
};

/**
 * Gives each group of device settings a consistent heading and spacing.
 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

interface SettingsSliderProps {
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
}

/**
 * Previews values while the user moves a slider and commits when the interaction ends.
 */
function SettingsSlider({
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
}: SettingsSliderProps) {
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

/**
 * Shows one action or lighting choice as an accessible radio option.
 */
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

interface BindingEditorProps {
  control: string;
  bindings: Binding[];
  actions: string[];
  disabled: boolean;
  resetLabel: string;
  onReset: () => void;
  onRebind: (bindings: Binding[]) => void;
}

/**
 * Edits the action assigned to the selected mouse button or keyboard key.
 */
function BindingEditor({
  control,
  bindings,
  actions,
  disabled,
  resetLabel,
  onReset,
  onRebind,
}: BindingEditorProps) {
  const controlName = controlLabel(control);
  const selectedAction = boundAction(bindings, control);

  const rebind = (action: string) =>
    onRebind(bindings.map((entry) => (entry.control === control ? { ...entry, action } : entry)));

  return (
    <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
      <legend className="sr-only">{controlName} action</legend>
      <div className="flex flex-col gap-8">
        <SettingsSection title={controlName}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {actions.map((action) => (
              <RadioOption
                key={action}
                group="action"
                value={action}
                label={actionLabel(action)}
                selected={action === selectedAction}
                onSelect={() => rebind(action)}
              />
            ))}
          </div>
        </SettingsSection>

        <button
          type="button"
          onClick={onReset}
          className={cn(BUTTON_OUTLINE, 'w-fit text-muted-foreground hover:text-foreground')}
        >
          <RotateCcw className="size-4" strokeWidth={1.75} />
          {resetLabel}
        </button>
      </div>
    </fieldset>
  );
}

/**
 * Shows the device details reported by the native stack and offers removal when allowed.
 */
function DeviceInfo({ device, onRemove }: { device: Device; onRemove: () => void }) {
  const details: [label: string, value: string][] = [
    ['Connection', connectionLabel(device)],
    ['Firmware', device.firmware],
  ];

  if (device.keyboard) {
    details.push(
      ['Remappable keys', String(device.keyboard.keys.length)],
      ['Lighting', device.keyboard.backlight ? 'Supported' : 'Not supported'],
    );
  }
  if (device.mouse) {
    details.push(
      ['Remappable buttons', String(device.mouse.buttons.length)],
      ['Sensor', `${device.mouse.minDpi}–${device.mouse.maxDpi} DPI`],
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection title="Info">
        <dl className="flex flex-col gap-4">
          {details.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      {device.link !== LinkType.WIRED && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            BUTTON_OUTLINE,
            'w-fit text-muted-foreground hover:border-destructive/35',
            'hover:bg-destructive/5 hover:text-foreground',
          )}
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
          Remove device
        </button>
      )}
    </div>
  );
}

interface MouseEditorProps {
  settings: Settings;
  mouse: MouseSettings;
  spec: MouseSpec;
  selected: string | null;
  segment: 'buttons' | 'movement';
  disabled: boolean;
  onPreview: SettingsChangeHandler;
  onCommit: SettingsChangeHandler;
}

/**
 * Shows button assignments or movement settings for a mouse.
 */
function MouseEditor({
  settings,
  mouse,
  spec,
  selected,
  segment,
  disabled,
  onPreview,
  onCommit,
}: MouseEditorProps) {
  const withMouseChanges = (changes: Partial<MouseSettings>): Settings => ({
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
        resetLabel="Reset all buttons"
        onReset={() =>
          onCommit(withMouseChanges({ bindings: resetMouseBindings(mouse.bindings) }))
        }
        onRebind={(bindings) => onCommit(withMouseChanges({ bindings }))}
      />
    );
  }

  const commitCurrentSettings = () => onCommit(settings);

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-10 disabled:opacity-50">
      <SettingsSection title="Pointer">
        <SettingsSlider
          label="Speed"
          display={`${mouse.dpi} DPI`}
          value={mouse.dpi}
          min={spec.minDpi}
          max={spec.maxDpi}
          step={DPI_STEP}
          minLabel={`${spec.minDpi} DPI`}
          maxLabel={`${spec.maxDpi} DPI`}
          description="Higher values move the pointer farther with less hand movement."
          onPreview={(dpi) => onPreview(withMouseChanges({ dpi }))}
          onCommit={commitCurrentSettings}
        />
      </SettingsSection>

      <SettingsSection title="Scrolling">
        <SettingsSlider
          label="Wheel speed"
          display={SCROLL_SPEED_LABELS[mouse.scrollSpeed - 1] ?? `${mouse.scrollSpeed}`}
          value={mouse.scrollSpeed}
          min={1}
          max={SCROLL_SPEED_LABELS.length}
          step={1}
          minLabel="Slower"
          maxLabel="Faster"
          onPreview={(scrollSpeed) => onPreview(withMouseChanges({ scrollSpeed }))}
          onCommit={commitCurrentSettings}
        />

        <div className="flex items-center justify-between gap-4">
          <span id="reverse-scroll" className="text-sm font-medium">
            Reverse direction
          </span>
          <Switch
            checked={mouse.naturalScroll}
            labelId="reverse-scroll"
            onChange={(naturalScroll) => onCommit(withMouseChanges({ naturalScroll }))}
          />
        </div>
      </SettingsSection>
    </fieldset>
  );
}

interface KeyboardEditorProps {
  settings: Settings;
  keyboard: KeyboardSettings;
  selected: string | null;
  segment: 'keys' | 'lighting';
  disabled: boolean;
  onPreview: SettingsChangeHandler;
  onCommit: SettingsChangeHandler;
}

/**
 * Shows key assignments or lighting settings for a keyboard.
 */
function KeyboardEditor({
  settings,
  keyboard,
  selected,
  segment,
  disabled,
  onPreview,
  onCommit,
}: KeyboardEditorProps) {
  const withKeyboardChanges = (changes: Partial<KeyboardSettings>): Settings => ({
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
        resetLabel="Reset all keys"
        onReset={() =>
          onCommit(withKeyboardChanges({ bindings: resetKeyBindings(keyboard.bindings) }))
        }
        onRebind={(bindings) => onCommit(withKeyboardChanges({ bindings }))}
      />
    );
  }

  const commitCurrentSettings = () => onCommit(settings);

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-10 disabled:opacity-50">
      <SettingsSection title="Effect">
        <div className="flex flex-col">
          {EFFECTS.map(([effect, label]) => (
            <RadioOption
              key={effect}
              group="effect"
              value={String(effect)}
              label={label}
              selected={effect === keyboard.effect}
              onSelect={() => onCommit(withKeyboardChanges({ effect }))}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Colour">
        <SettingsSlider
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
          trackStyle={HUE_TRACK_STYLE}
          onPreview={(hue) => onPreview(withKeyboardChanges({ hue }))}
          onCommit={commitCurrentSettings}
        />
      </SettingsSection>

      <SettingsSection title="Brightness">
        <SettingsSlider
          label="Level"
          display={`${keyboard.brightness}%`}
          value={keyboard.brightness}
          min={0}
          max={100}
          step={1}
          minLabel="Off"
          maxLabel="Bright"
          onPreview={(brightness) => onPreview(withKeyboardChanges({ brightness }))}
          onCommit={commitCurrentSettings}
        />
      </SettingsSection>
    </fieldset>
  );
}

interface ControlEditorProps {
  device: Device;
  settings: Settings;
  selected: string | null;
  segment: Segment;
  disabled: boolean;
  onRemove: () => void;
  onPreview: SettingsChangeHandler;
  onCommit: SettingsChangeHandler;
}

/**
 * Chooses the settings panel that matches the device type and selected section.
 */
export function ControlEditor({
  device,
  settings,
  selected,
  segment,
  disabled,
  onRemove,
  onPreview,
  onCommit,
}: ControlEditorProps) {
  if (segment === 'info') {
    return <DeviceInfo device={device} onRemove={onRemove} />;
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
