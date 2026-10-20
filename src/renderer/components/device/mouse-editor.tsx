import type { MouseSettings, MouseSpec, Settings } from '@/gen/devices';
import {
  BindingEditor,
  BrightnessSlider,
  HueSlider,
  SettingsSection,
  SettingsSlider,
} from './editor-controls';
import { MOUSE_ACTIONS, mouseControlLabel, resetMouseBindings } from './mouse-device';

const DPI_STEP = 100;

interface MouseEditorProps {
  settings: Settings;
  mouse: MouseSettings;
  spec: MouseSpec;
  selected: string | null;
  segment: 'buttons' | 'movement' | 'lighting';
  disabled: boolean;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}

/**
 * Shows button assignments, movement, or lighting settings for a mouse.
 */
export function MouseEditor({
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
        controlName={mouseControlLabel(selected)}
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

  if (segment === 'lighting') {
    return (
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-10 disabled:opacity-50">
        <HueSlider
          hue={mouse.hue}
          onPreview={(hue) => onPreview(withMouseChanges({ hue }))}
          onCommit={commitCurrentSettings}
        />

        <BrightnessSlider
          brightness={mouse.brightness}
          onPreview={(brightness) => onPreview(withMouseChanges({ brightness }))}
          onCommit={commitCurrentSettings}
        />
      </fieldset>
    );
  }

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
    </fieldset>
  );
}
