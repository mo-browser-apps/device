import type { CSSProperties, ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Binding } from '@/gen/devices';
import { BUTTON_OUTLINE, cn, FOCUS_RING } from '@/lib/utils';
import { actionLabel, boundAction } from './controls';

/**
 * Gives each group of device settings a consistent heading and spacing.
 */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
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
export function SettingsSlider({
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

interface RadioOptionProps {
  group: string;
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Shows one action or lighting choice as an accessible radio option.
 */
export function RadioOption({
  group,
  value,
  label,
  selected,
  onSelect,
}: RadioOptionProps) {
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
  controlName: string;
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
export function BindingEditor({
  control,
  controlName,
  bindings,
  actions,
  disabled,
  resetLabel,
  onReset,
  onRebind,
}: BindingEditorProps) {
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
