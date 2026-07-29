import { app, BrowserWindow } from '@mobrowser/api';
import { buildApplicationMenu } from './menu';
import { startDevices } from './devices';
import { startSettings } from './settings';
import * as process from 'node:process';

const isMac = process.platform === 'darwin';

const win = new BrowserWindow();

startDevices();
startSettings(win);

win.browser.loadUrl(app.url);
win.browser.zoom.setEnabled(false);

win.setSize({ width: 1000, height: 620 });
win.setMinimumSize({ width: 1000, height: 620 });
win.setWindowTitleVisible(false);
win.setWindowTitlebarVisible(!isMac);
win.centerWindow();
win.show();

if (isMac) {
  app.setMenu(buildApplicationMenu());
}
