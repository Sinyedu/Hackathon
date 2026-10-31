import { app, globalShortcut } from 'electron';
import { createAgentHost } from './agent-host';
import { registerIpc, stopAll } from './ipc';
import { createMascotController } from './mascot-controller';
import { installGlobalHardening } from './security';
import { loadSettings } from './settings-store';
import { createTray } from './tray';
import { createVoiceHost } from './voice-host';
import { createOverlayWindow, createPanelWindow, createVoiceWindow } from './windows';

const TOGGLE_PANEL_SHORTCUT = 'CommandOrControl+Shift+K';
const TALK_SHORTCUT = 'CommandOrControl+Shift+Space';

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

function registerShortcut(accelerator: string, action: () => void): void {
  if (!globalShortcut.register(accelerator, action))
    console.warn(`Could not register global shortcut ${accelerator}`);
}

function start(): void {
  const { value: settings, problem } = loadSettings();
  if (problem) console.warn(problem);
  const overlay = createOverlayWindow(settings);
  const panel = createPanelWindow();
  const controller = createMascotController(overlay, panel, settings);

  const host = createAgentHost(settings);
  const voice = createVoiceHost(createVoiceWindow(), settings);
  voice.configureWhenReady();
  registerIpc(controller, host, voice);

  registerShortcut(TOGGLE_PANEL_SHORTCUT, () => controller.togglePanel());
  registerShortcut(TALK_SHORTCUT, () => voice.command({ type: 'captureStart', via: 'tap' }));
  createTray(controller, () => stopAll(host, voice));

  app.on('second-instance', () => {
    if (!overlay.isVisible()) controller.toggleOverlay();
    controller.togglePanel();
  });
}
