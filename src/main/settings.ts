import { app, ipc, prefs, BrowserWindow, Notification, Theme } from '@mobrowser/api';
import { native } from './gen/native';
import { AppSettings } from './gen/app';
import { AppServiceDescriptor } from './gen/ipc_service';
import type { Device, DeviceList } from './gen/native/devices';

const THEME_KEY = 'app.theme';
const LOW_BATTERY_ALERTS_KEY = 'app.lowBatteryAlerts';
const LOW_BATTERY = 20;

const lowBattery = new Set<string>();

const appEvents = ipc.registerService(AppServiceDescriptor);
let mainWindow: BrowserWindow;

export function persistPreferences(): void {
  if (!prefs.persist()) {
    console.warn('Could not write preferences.');
  }
}

function notifyLowBattery(device: Device): void {
  const { id } = device;

  const notification = new Notification({
    title: `${device.model} battery is low`,
    body: `${device.battery}% remaining. Charge it soon.`,
    silent: true,
  });

  notification.on('clicked', () => {
    if (mainWindow.isMinimized) {
      mainWindow.restore();
    }
    mainWindow.focus();
    appEvents.OnOpenDevice({ id });
  });

  notification.show();
}

function isLow(device: Device): boolean {
  return device.connected && device.hasBattery && !device.charging && device.battery <= LOW_BATTERY;
}

/** Notifies for devices that have just entered a low-battery episode. */
export function checkBatteries(devices: DeviceList): void {
  if (!prefs.getBoolean(LOW_BATTERY_ALERTS_KEY, false)) return;

  for (const device of devices.devices) {
    if (isLow(device)) {
      if (!lowBattery.has(device.id)) {
        lowBattery.add(device.id);
        notifyLowBattery(device);
      }
    } else if (device.hasBattery && device.battery > LOW_BATTERY) {
      lowBattery.delete(device.id);
    }
  }
}

export function startSettings(win: BrowserWindow): void {
  mainWindow = win;

  app.setTheme(prefs.getString(THEME_KEY, 'system') as Theme);

  ipc.registerService(AppServiceDescriptor, {
    async GetSettings() {
      return {
        theme: prefs.getString(THEME_KEY, 'system'),
        launchAtLogin: app.loginItemSettings.openAtLogin,
        lowBatteryAlerts: prefs.getBoolean(LOW_BATTERY_ALERTS_KEY, false),
      };
    },

    async ApplySettings(request: AppSettings) {
      app.setTheme(request.theme as Theme);

      if (request.launchAtLogin !== app.loginItemSettings.openAtLogin) {
        app.setLoginItemSettings({ openAtLogin: request.launchAtLogin });
      }

      const alertsWereOn = prefs.getBoolean(LOW_BATTERY_ALERTS_KEY, false);

      prefs.setString(THEME_KEY, request.theme);
      prefs.setBoolean(LOW_BATTERY_ALERTS_KEY, request.lowBatteryAlerts);
      persistPreferences();

      if (!request.lowBatteryAlerts) {
        lowBattery.clear();
      } else if (!alertsWereOn) {
        checkBatteries(await native.deviceStack.List({}));
      }
      return {};
    },
  });
}
