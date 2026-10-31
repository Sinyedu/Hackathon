import { join } from 'node:path';
import { app, Menu, nativeImage, Tray } from 'electron';
import type { MascotController } from './mascot-controller';
import { createGalleryWindow } from './windows';

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
      ...(process.env['ELECTRON_RENDERER_URL']
        ? [{ label: 'State gallery (dev)', click: () => void createGalleryWindow() }]
        : []),
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  return tray;
}
