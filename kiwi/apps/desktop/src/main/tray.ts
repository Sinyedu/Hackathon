import { join } from 'node:path';
import { app, Menu, nativeImage, Tray } from 'electron';
import type { MascotController } from './mascot-controller';

const trayIconPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'resources', 'tray.png')
    : join(app.getAppPath(), 'resources', 'tray.png');

export function createTray(controller: MascotController): Tray {
  const icon = nativeImage.createFromPath(trayIconPath());
  const tray = new Tray(icon);
  tray.setToolTip('Kiwi');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show / Hide Kiwi', click: () => controller.toggleOverlay() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  return tray;
}
