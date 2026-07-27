import { app, BrowserWindow, ipc, Theme } from '@mobrowser/api';
import { SetThemeRequest } from './gen/app';
import { AppServiceDescriptor } from './gen/ipc_service';
import { buildApplicationMenu } from './menu';
import * as process from 'node:process';

const isMac = process.platform === 'darwin';

const win = new BrowserWindow();
win.browser.loadUrl(app.url);
win.setSize({ width: 1000, height: 700 });
win.setMinimumSize({ width: 860, height: 600 });
win.setWindowTitleVisible(false);
win.setWindowTitlebarVisible(!isMac);
win.centerWindow();
win.show();

if (isMac) {
  app.setMenu(buildApplicationMenu());
}

ipc.registerService(AppServiceDescriptor, {
  async SetTheme(request: SetThemeRequest) {
    app.setTheme(request.theme as Theme);
    return {};
  },
});
