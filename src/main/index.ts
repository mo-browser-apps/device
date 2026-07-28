import { app, BrowserWindow, ipc, Theme } from '@mobrowser/api';
import { SetThemeRequest } from './gen/app';
import { AppServiceDescriptor } from './gen/ipc_service';
import { buildApplicationMenu } from './menu';
import { startDevices } from './devices';
import { startSimulator } from './simulator';
import * as process from 'node:process';

const isMac = process.platform === 'darwin';

ipc.registerService(AppServiceDescriptor, {
  async SetTheme(request: SetThemeRequest) {
    app.setTheme(request.theme as Theme);
    return {};
  },
});
startDevices();
startSimulator();

const win = new BrowserWindow();
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
