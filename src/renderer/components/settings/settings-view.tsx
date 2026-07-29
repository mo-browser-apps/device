import { useId, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LOW_BATTERY } from '@/components/device-status';
import { Switch } from '@/components/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { AppSettings } from '@/gen/app';
import { BUTTON_ICON, TOGGLE_ITEM } from '@/lib/utils';

const THEMES: [string, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="rounded-xl border bg-card/50 px-5 py-4 shadow-xs">{children}</div>
    </section>
  );
}

function Setting({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: (labelledBy: string) => ReactNode;
}) {
  const titleId = useId();

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {control(titleId)}
    </div>
  );
}

export function SettingsView({
  settings,
  update,
  onBack,
}: {
  settings: AppSettings | null;
  update: (changes: Partial<AppSettings>) => void;
  onBack: () => void;
}) {
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
            <Section title="Appearance">
              <Setting
                title="Theme"
                description="Match the app appearance to your preference."
                control={(labelledBy) => (
                  <ToggleGroup
                    type="single"
                    value={settings.theme}
                    aria-labelledby={labelledBy}
                    onValueChange={(theme) => theme && update({ theme })}
                    className="shrink-0 rounded-lg bg-muted p-1"
                  >
                    {THEMES.map(([value, label]) => (
                      <ToggleGroupItem key={value} value={value} className={TOGGLE_ITEM}>
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              />
            </Section>

            <Section title="General">
              <Setting
                title="Launch at login"
                description="Open the app automatically when you sign in."
                control={(labelledBy) => (
                  <Switch
                    checked={settings.launchAtLogin}
                    labelledBy={labelledBy}
                    onChange={(launchAtLogin) => update({ launchAtLogin })}
                  />
                )}
              />
            </Section>

            <Section title="Notifications">
              <Setting
                title="Low battery alerts"
                description={`Notify when a wireless device reaches ${LOW_BATTERY}%.`}
                control={(labelledBy) => (
                  <Switch
                    checked={settings.lowBatteryAlerts}
                    labelledBy={labelledBy}
                    onChange={(lowBatteryAlerts) => update({ lowBatteryAlerts })}
                  />
                )}
              />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
