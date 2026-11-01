export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export const DOCK_GAP = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Top-left position for the chat panel: centered under the mascot, flipped above it when
 * there is no room below, and clamped inside the work area.
 */
export function computeDockPosition(
  mascotBounds: Rect,
  panelSize: Size,
  workArea: Rect,
  gap: number = DOCK_GAP,
): Point {
  const centeredX = mascotBounds.x + (mascotBounds.width - panelSize.width) / 2;
  const below = mascotBounds.y + mascotBounds.height + gap;
  const above = mascotBounds.y - gap - panelSize.height;
  const fitsBelow = below + panelSize.height <= workArea.y + workArea.height;
  const preferredY = fitsBelow ? below : above;

  return {
    x: Math.round(clamp(centeredX, workArea.x, workArea.x + workArea.width - panelSize.width)),
    y: Math.round(clamp(preferredY, workArea.y, workArea.y + workArea.height - panelSize.height)),
  };
}
