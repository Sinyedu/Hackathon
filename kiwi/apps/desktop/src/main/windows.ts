import { join } from 'node:path';
import { BrowserWindow, screen } from 'electron';
import { OVERLAY_SIZE, PANEL_SIZE, type Settings } from '@kiwi/shared';

type Page = 'overlay' | 'panel';

const webPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

function loadPage(window: BrowserWindow, page: Page): void {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  const target = devServerUrl
    ? window.loadURL(`${devServerUrl}/${page}/index.html`)
    : window.loadFile(join(__dirname, `../renderer/${page}/index.html`));
  target.catch((error: unknown) => console.error(`Failed to load ${page} window`, error));
}

function defaultOverlayPosition(): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - OVERLAY_SIZE.width - 24,
    y: workArea.y + 24,
  };
}

export function createOverlayWindow(settings: Settings): BrowserWindow {
  const position = settings.overlayPosition ?? defaultOverlayPosition();
  const window = new BrowserWindow({
    ...OVERLAY_SIZE,
    ...position,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences,
  });
  window.setAlwaysOnTop(true, 'floating');
  window.once('ready-to-show', () => window.show());
  loadPage(window, 'overlay');
  return window;
}

export function createPanelWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...PANEL_SIZE,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences,
  });
  window.setAlwaysOnTop(true, 'floating');
  loadPage(window, 'panel');
  return window;
}
