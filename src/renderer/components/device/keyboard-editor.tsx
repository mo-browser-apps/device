import type { CSSProperties } from 'react';
import type { KeyboardSettings, Settings } from '@/gen/devices';
import { EFFECTS, KEY_ACTIONS, resetKeyBindings } from './controls';
import {
  BindingEditor,
  RadioOption,
  SettingsSection,
  SettingsSlider,
} from './editor-controls';

/**
 * Draws the color range behind the keyboard hue slider.
 */
const HUE_TRACK_STYLE: CSSProperties = {
  background: `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360]
    .map((hue) => `hsl(${hue} 95% 55%)`)
    .join(', ')})`,
};

interface KeyboardEditorProps {
  settings: Settings;
  keyboard: KeyboardSettings;
  selected: string | null;
  segment: 'keys' | 'lighting';
  disabled: boolean;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}

/**
 * Shows key assignments or lighting settings for a keyboard.
 */
export function KeyboardEditor({
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
