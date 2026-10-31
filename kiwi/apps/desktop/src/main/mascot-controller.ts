import { screen, type BrowserWindow } from 'electron';
import { computeDockPosition } from '@kiwi/core';
import { MASCOT_HIT_AREA, PANEL_SIZE, type DragMove, type Settings } from '@kiwi/shared';
import { saveSettings } from './settings-store';

export interface MascotController {
  setInteractive(interactive: boolean): void;
  dragStart(): void;
  dragMove(delta: DragMove): void;
  dragEnd(): void;
  togglePanel(): void;
  hidePanel(): void;
  toggleOverlay(): void;
  isOwnWebContents(id: number): boolean;
}

function configureHitArea(overlay: BrowserWindow): boolean {
  // Mouse forwarding is unsupported on Linux, so there the window is shaped to the mascot instead.
  const usesWindowShape = process.platform === 'linux';
  if (usesWindowShape) overlay.setShape([MASCOT_HIT_AREA]);
  else overlay.setIgnoreMouseEvents(true, { forward: true });
  return usesWindowShape;
}

function createDocking(overlay: BrowserWindow, panel: BrowserWindow): () => void {
  return () => {
    const mascotBounds = overlay.getBounds();
    const { workArea } = screen.getDisplayMatching(mascotBounds);
    const { x, y } = computeDockPosition(mascotBounds, PANEL_SIZE, workArea);
    panel.setPosition(x, y);
  };
}

type DragHandlers = Pick<MascotController, 'dragStart' | 'dragMove' | 'dragEnd'>;

function createDragHandlers(
  overlay: BrowserWindow,
  panel: BrowserWindow,
  settings: Settings,
  dockPanel: () => void,
): DragHandlers {
  let origin: { x: number; y: number } | null = null;
  return {
    dragStart() {
      const [x = 0, y = 0] = overlay.getPosition();
      origin = { x, y };
    },
    dragMove({ dx, dy }) {
      if (!origin) return;
      overlay.setPosition(Math.round(origin.x + dx), Math.round(origin.y + dy));
      if (panel.isVisible()) dockPanel();
    },
    dragEnd() {
      if (!origin) return;
      origin = null;
      const [x = 0, y = 0] = overlay.getPosition();
      settings.overlayPosition = { x, y };
      saveSettings(settings);
    },
  };
}

/** Owns the overlay/panel relationship: click-through, dragging and docking. */
export function createMascotController(
  overlay: BrowserWindow,
  panel: BrowserWindow,
  settings: Settings,
): MascotController {
  const usesWindowShape = configureHitArea(overlay);
  const dockPanel = createDocking(overlay, panel);

  overlay.on('closed', () => panel.destroy());
  panel.on('close', (event) => {
    if (overlay.isDestroyed()) return;
    event.preventDefault();
    panel.hide();
  });

  return {
    ...createDragHandlers(overlay, panel, settings, dockPanel),
    setInteractive(interactive) {
      if (!usesWindowShape) overlay.setIgnoreMouseEvents(!interactive, { forward: true });
    },
    togglePanel() {
      if (panel.isVisible()) {
        panel.hide();
        return;
      }
      dockPanel();
      panel.show();
      panel.focus();
    },
    hidePanel: () => panel.hide(),
    toggleOverlay() {
      if (overlay.isVisible()) {
        panel.hide();
        overlay.hide();
      } else overlay.show();
    },
    isOwnWebContents: (id) => id === overlay.webContents.id || id === panel.webContents.id,
  };
}
