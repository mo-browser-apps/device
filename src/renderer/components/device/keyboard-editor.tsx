import type { KeyboardSettings, KeyboardSpec, Settings } from '@/gen/devices';
import {
  BindingEditor,
  BrightnessSlider,
  HueSlider,
  RadioOption,
  SettingsSection,
} from './editor-controls';
import {
  KEY_ACTIONS,
  KEYBOARD_EFFECTS,
  keyboardControlLabel,
  resetKeyBindings,
} from './keyboard-device';

interface KeyboardEditorProps {
  settings: Settings;
  keyboard: KeyboardSettings;
  spec: KeyboardSpec;
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
  spec,
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
        controlName={keyboardControlLabel(selected)}
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
  const effects = KEYBOARD_EFFECTS.filter(([effect]) => spec.effects.includes(effect));

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-10 disabled:opacity-50">
      <SettingsSection title="Effect">
        <div className="flex flex-col">
          {effects.map(([effect, label]) => (
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

      {spec.color && (
        <HueSlider
          hue={keyboard.hue}
          onPreview={(hue) => onPreview(withKeyboardChanges({ hue }))}
          onCommit={commitCurrentSettings}
        />
      )}

      <BrightnessSlider
        brightness={keyboard.brightness}
        onPreview={(brightness) => onPreview(withKeyboardChanges({ brightness }))}
        onCommit={commitCurrentSettings}
      />
    </fieldset>
  );
}
