import { app, globalShortcut } from 'electron';
import { registerIpc } from './ipc';
import { createMascotController } from './mascot-controller';
import { installGlobalHardening } from './security';
import { loadSettings } from './settings-store';
import { createTray } from './tray';
import { createOverlayWindow, createPanelWindow } from './windows';

const TOGGLE_PANEL_SHORTCUT = 'CommandOrControl+Shift+K';

// Transparent always-on-top windows need X11 semantics; native Wayland ignores window positions.
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', 'x11');

installGlobalHardening();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

function start(): void {
  const settings = loadSettings();
  const overlay = createOverlayWindow(settings);
  const panel = createPanelWindow();
  const controller = createMascotController(overlay, panel, settings);

  registerIpc(controller);
  createTray(controller);

  if (!globalShortcut.register(TOGGLE_PANEL_SHORTCUT, () => controller.togglePanel())) {
    console.warn(`Could not register global shortcut ${TOGGLE_PANEL_SHORTCUT}`);
  }

  app.on('second-instance', () => {
    if (!overlay.isVisible()) controller.toggleOverlay();
    controller.togglePanel();
  });
}
