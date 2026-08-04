/**
 * Starts the main process, connects its services, and opens the application window.
 */
import { app, BrowserWindow } from '@mobrowser/api';
import { buildApplicationMenu } from './menu';
import { startDevices } from './devices';
import { startSettings } from './settings';
import { checkForUpdates } from './updates';
import * as process from 'node:process';

const isMac = process.platform === 'darwin';
const WINDOW_SIZE = { width: 1000, height: 620 };

const win = new BrowserWindow({
  size: WINDOW_SIZE,
  minimumSize: WINDOW_SIZE,
  windowTitleVisible: false,
  windowTitlebarVisible: !isMac,
});

startDevices();
startSettings(win);

win.browser.loadUrl(app.url);
win.browser.zoom.setEnabled(false);

win.centerWindow();
win.show();

if (isMac) {
  app.setMenu(buildApplicationMenu());
}

void checkForUpdates(win).catch((error: unknown) => {
  console.warn('Could not finish the application update check.', error);
});
