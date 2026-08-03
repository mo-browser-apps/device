import { useId, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LOW_BATTERY } from '@/components/device-status';
import { Switch } from '@/components/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { AppSettings } from '@/gen/app';
import { BUTTON_ICON, TOGGLE_ITEM } from '@/lib/utils';

const THEME_OPTIONS = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
] as const;

interface SettingRowProps {
  title: string;
  description: string;
  renderControl: (labelId: string) => ReactNode;
}

interface SettingsViewProps {
  settings: AppSettings | null;
  update: (changes: Partial<AppSettings>) => void;
  onBack: () => void;
}

/**
 * Groups related application settings under one heading.
 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-5 rounded-xl border bg-card/50 px-5 py-4 shadow-xs">
        {children}
      </div>
    </section>
  );
}

/**
 * Pairs a setting's title and description with its interactive control.
 */
function SettingRow({
  title,
  description,
  renderControl,
}: SettingRowProps) {
  const titleId = useId();

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {renderControl(titleId)}
    </div>
  );
}

/**
 * Shows app-wide settings and sends each change back to the main process.
 */
export function SettingsView({
  settings,
  update: updateSettings,
  onBack,
}: SettingsViewProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-175 flex-col gap-8 px-8 pb-12">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to devices" className={BUTTON_ICON}>
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        </div>

        {settings && (
          <div className="flex flex-col gap-7">
            <SettingsSection title="General">
              <SettingRow
                title="Download updates automatically"
                description="Download new versions in the background."
                renderControl={(labelId) => (
                  <Switch
                    checked={settings.automaticUpdateDownloads}
                    labelId={labelId}
                    onChange={(automaticUpdateDownloads) =>
                      updateSettings({ automaticUpdateDownloads })
                    }
                  />
                )}
              />
              <SettingRow
                title="Launch at login"
                description="Open the app automatically when you sign in."
                renderControl={(labelId) => (
                  <Switch
                    checked={settings.launchAtLogin}
                    labelId={labelId}
                    onChange={(launchAtLogin) => updateSettings({ launchAtLogin })}
                  />
                )}
              />
            </SettingsSection>

            <SettingsSection title="Appearance">
              <SettingRow
                title="Theme"
                description="Match the app appearance to your preference."
                renderControl={(labelId) => (
                  <ToggleGroup
                    type="single"
                    value={settings.theme}
                    aria-labelledby={labelId}
                    onValueChange={(theme) => theme && updateSettings({ theme })}
                    className="shrink-0 rounded-lg bg-muted p-1"
                  >
                    {THEME_OPTIONS.map(([value, label]) => (
                      <ToggleGroupItem key={value} value={value} className={TOGGLE_ITEM}>
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              />
            </SettingsSection>

            <SettingsSection title="Notifications">
              <SettingRow
                title="Low battery alerts"
                description={`Notify when a wireless device reaches ${LOW_BATTERY}%.`}
                renderControl={(labelId) => (
                  <Switch
                    checked={settings.lowBatteryAlerts}
                    labelId={labelId}
                    onChange={(lowBatteryAlerts) => updateSettings({ lowBatteryAlerts })}
                  />
                )}
              />
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
  );
}
