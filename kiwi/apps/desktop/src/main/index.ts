import { app, globalShortcut } from 'electron';
import { createAgentHost } from './agent-host';
import { createOllamaClient } from './adapters/ollama-client';
import { createSystemSpeech } from './adapters/system-speech';
import { defaultSandboxRoot } from './adapters/sandbox-notes';
import { seedDemoDownloads } from './adapters/sandbox-files';
import { registerIpc, stopAll } from './ipc';
import { installCrashLogging, log } from './logger';
import { createMascotController } from './mascot-controller';
import { installGlobalHardening } from './security';
import { createSetupHost } from './setup-host';
import { loadSettings } from './settings-store';
import { registerShortcuts } from './shortcuts';
import { createTray } from './tray';
import { createVoiceHost } from './voice-host';
import { createOverlayWindow, createPanelWindow, createVoiceWindow } from './windows';

// Transparent always-on-top windows need X11 semantics; native Wayland ignores window positions.
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', 'x11');

installGlobalHardening();
installCrashLogging();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

function start(): void {
  const { value: settings, problem } = loadSettings();
  if (problem) log.warn(problem);
  const overlay = createOverlayWindow(settings);
  const panel = createPanelWindow();
  const controller = createMascotController(overlay, panel, settings);

  const llm = createOllamaClient(settings.ollamaUrl);
  const host = createAgentHost(settings, llm);
  const talk = (): void => voice.command({ type: 'captureStart', via: 'tap' });
  const shortcuts = (): void =>
    registerShortcuts(settings, { togglePanel: () => controller.togglePanel(), talk });
  const voice = createVoiceHost(createVoiceWindow(), settings, shortcuts);
  voice.configureWhenReady();
  const speech = createSystemSpeech();
  registerIpc(
    controller,
    host,
    voice,
    createSetupHost(llm, () => settings.ollamaUrl),
    speech,
  );

  shortcuts();
  createTray(controller, () => stopAll(host, voice, speech));
  void seedDemoDownloads(settings.sandboxPath ?? defaultSandboxRoot()).catch((error: unknown) =>
    log.error('Could not seed demo files', error),
  );
  if (!settings.setupDone) panel.once('ready-to-show', () => controller.togglePanel());

  app.on('second-instance', () => {
    if (!overlay.isVisible()) controller.toggleOverlay();
    controller.togglePanel();
  });
}
