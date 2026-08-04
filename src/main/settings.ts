import { app, ipc, prefs, BrowserWindow, Notification, Theme } from '@mobrowser/api';
import { native } from './gen/native';
import { AppSettings } from './gen/app';
import { AppServiceDescriptor } from './gen/ipc_service';
import type { Device, DeviceList } from './gen/native/devices';

const THEME_KEY = 'app.theme';
const LOW_BATTERY_ALERTS_KEY = 'app.lowBatteryAlerts';
const AUTOMATIC_UPDATE_DOWNLOADS_KEY = 'app.automaticUpdateDownloads';
const LOW_BATTERY = 20;

const lowBattery = new Set<string>();

const appEvents = ipc.registerService(AppServiceDescriptor);
let mainWindow: BrowserWindow;

/**
 * Writes the current main-process preferences to disk.
 */
export function persistPreferences(): void {
  if (!prefs.persist()) {
    console.warn('Could not write preferences.');
  }
}

/**
 * Reports whether available application updates should download without asking first.
 */
export function shouldDownloadUpdatesAutomatically(): boolean {
  return prefs.getBoolean(AUTOMATIC_UPDATE_DOWNLOADS_KEY, true);
}

/**
 * Shows a system alert that opens the matching device when clicked.
 */
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

/**
 * Reports whether a device should currently show a low-battery alert.
 */
function isLow(device: Device): boolean {
  return device.connected && device.hasBattery && !device.charging && device.battery <= LOW_BATTERY;
}

/**
 * Shows one alert when a managed device enters a low-battery state.
 */
export function checkBatteries(devices: DeviceList): void {
  if (!prefs.getBoolean(LOW_BATTERY_ALERTS_KEY, false)) return;

  const currentDevices = new Set<string>();

  for (const device of devices.devices) {
    currentDevices.add(device.id);

    if (isLow(device)) {
      if (!lowBattery.has(device.id)) {
        lowBattery.add(device.id);
        notifyLowBattery(device);
      }
    } else {
      lowBattery.delete(device.id);
    }
  }

  for (const deviceId of lowBattery) {
    if (!currentDevices.has(deviceId)) lowBattery.delete(deviceId);
  }
}

/**
 * Connects renderer settings requests to saved preferences and MōBrowser system APIs.
 */
export function startSettings(win: BrowserWindow): void {
  mainWindow = win;

  app.setTheme(prefs.getString(THEME_KEY, 'system') as Theme);

  ipc.registerService(AppServiceDescriptor, {
    async GetSettings() {
      return {
        theme: prefs.getString(THEME_KEY, 'system'),
        launchAtLogin: app.loginItemSettings.openAtLogin,
        lowBatteryAlerts: prefs.getBoolean(LOW_BATTERY_ALERTS_KEY, false),
        automaticUpdateDownloads: shouldDownloadUpdatesAutomatically(),
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
      prefs.setBoolean(AUTOMATIC_UPDATE_DOWNLOADS_KEY, request.automaticUpdateDownloads);
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
