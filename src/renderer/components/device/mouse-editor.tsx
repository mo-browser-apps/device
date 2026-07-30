import type { MouseSettings, MouseSpec, Settings } from '@/gen/devices';
import { Switch } from '@/components/switch';
import { MOUSE_ACTIONS, resetMouseBindings } from './controls';
import { BindingEditor, SettingsSection, SettingsSlider } from './editor-controls';

const DPI_STEP = 100;
const SCROLL_SPEED_LABELS = ['Very slow', 'Slow', 'Medium', 'Fast', 'Very fast'];

interface MouseEditorProps {
  settings: Settings;
  mouse: MouseSettings;
  spec: MouseSpec;
  selected: string | null;
  segment: 'buttons' | 'movement';
  disabled: boolean;
  onPreview: (settings: Settings) => void;
  onCommit: (settings: Settings) => void;
}

/**
 * Shows button assignments or movement settings for a mouse.
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
