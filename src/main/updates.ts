import { app, type BrowserWindow } from '@mobrowser/api';
import * as process from 'node:process';
import { shouldDownloadUpdatesAutomatically } from './settings';

const UPDATE_SOURCE = 'https://github.com/mo-browser-apps/device/releases/latest/download';

/**
 * Shows a download failure after the user has chosen to install an update.
 */
async function showDownloadError(win: BrowserWindow, error?: string): Promise<void> {
  await app.showMessageDialog({
    parentWindow: win,
    type: 'error',
    title: 'Software Update',
    message: 'The update could not be downloaded.',
    informativeText: error ?? 'Please try again later.',
    buttons: [{ label: 'Close', type: 'primary' }],
  });
}

/**
 * Checks GitHub Releases and guides the user through downloading and restarting.
 */
export async function checkForUpdates(win: BrowserWindow): Promise<void> {
  if (!app.packaged || (process.platform !== 'darwin' && process.platform !== 'win32')) return;

  let update;
  try {
    update = await app.checkForUpdate(UPDATE_SOURCE);
  } catch (error) {
    console.warn('Could not check for application updates.', error);
    return;
  }

  if (!update) return;
  if (typeof update === 'string') {
    console.warn('Could not check for application updates.', update);
    return;
  }

  const automaticDownload = shouldDownloadUpdatesAutomatically();
  if (!automaticDownload) {
    const confirmation = await app.showMessageDialog({
      parentWindow: win,
      type: 'info',
      title: 'Software Update',
      message: `Version ${update.version} is available.`,
      informativeText: 'Would you like to download it now?',
      buttons: [
        { label: 'Download', type: 'primary' },
        { label: 'Later', type: 'secondary' },
      ],
    });

    if (confirmation.button.type !== 'primary') {
      update.dismiss();
      return;
    }
  }

  let download;
  try {
    download = await update.download();
  } catch (error) {
    if (automaticDownload) {
      console.warn('Could not download the application update.', error);
    } else {
      await showDownloadError(win, error instanceof Error ? error.message : undefined);
    }
    return;
  }

  if (!download.success) {
    if (automaticDownload) {
      console.warn('Could not download the application update.', download.error);
    } else {
      await showDownloadError(win, download.error);
    }
    return;
  }

  const restart = await app.showMessageDialog({
    parentWindow: win,
    type: 'info',
    title: 'Software Update',
    message: 'The update is ready to install.',
    informativeText: 'Restart the app to finish updating.',
    buttons: [
      { label: 'Restart', type: 'primary' },
      { label: 'Later', type: 'secondary' },
    ],
  });

  if (restart.button.type === 'primary') {
    app.restart();
  }
}
