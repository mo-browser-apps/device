import { app, workspace, Menu, MenuItem, MenuWithRole } from '@mobrowser/api';

const DISPLAY_NAME = 'MōDevice';
const REPOSITORY_URL = 'https://github.com/mo-browser-apps/device';

async function showAbout(): Promise<void> {
  const result = await app.showMessageDialog({
    type: 'info',
    message: `${DISPLAY_NAME} ${app.version}`,
    informativeText: `${app.description}\n\nPowered by MōBrowser.\n\n${app.copyright}`,
    buttons: [
      { label: 'Close', type: 'primary' },
      { label: 'Open GitHub Repository...', type: 'secondary' },
    ],
  });
  if (result.button.type === 'secondary') {
    workspace.openUrl(REPOSITORY_URL);
  }
}

export function buildApplicationMenu(): Menu {
  const appMenu = new MenuWithRole({
    role: 'macAppMenu',
    items: [
      new MenuItem({
        id: 'about',
        label: `About ${DISPLAY_NAME}`,
        action: () => void showAbout().catch(() => {}),
      }),
      'separator',
      'macHideApp',
      'macHideOthers',
      'macShowAll',
      'separator',
      new MenuItem({
        id: 'quit',
        label: `Quit ${DISPLAY_NAME}`,
        shortcut: 'CommandOrControl+Q',
        action: () => app.quit(),
      }),
    ],
  });

  const editMenu = new MenuWithRole({
    role: 'editMenu',
    items: ['undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'selectAll'],
  });

  const windowMenu = new MenuWithRole({ role: 'windowMenu', items: ['minimizeWindow'] });

  return new Menu({ items: [appMenu, editMenu, windowMenu] });
}
