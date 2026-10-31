import { describe, expect, it } from 'vitest';
import { computeDockPosition, type Rect, type Size } from './dock';

const panel: Size = { width: 380, height: 520 };
const workArea: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
const mascot = (x: number, y: number): Rect => ({ x, y, width: 200, height: 200 });

describe('computeDockPosition', () => {
  it('centers the panel under the mascot', () => {
    expect(computeDockPosition(mascot(800, 100), panel, workArea)).toEqual({ x: 710, y: 308 });
  });

  it('flips above the mascot when there is no room below', () => {
    expect(computeDockPosition(mascot(800, 800), panel, workArea)).toEqual({ x: 710, y: 272 });
  });

  it('stays below when the panel fits exactly', () => {
    const y = workArea.height - panel.height - 8 - 200;
    expect(computeDockPosition(mascot(800, y), panel, workArea).y).toBe(y + 208);
  });

  it('clamps to the left edge', () => {
    expect(computeDockPosition(mascot(0, 100), panel, workArea).x).toBe(0);
  });

  it('clamps to the right edge', () => {
    expect(computeDockPosition(mascot(1720, 100), panel, workArea).x).toBe(1540);
  });

  it('clamps to the top edge when flipping above would leave the screen', () => {
    const shortArea: Rect = { x: 0, y: 0, width: 1920, height: 600 };
    expect(computeDockPosition(mascot(800, 300), panel, shortArea).y).toBe(0);
  });

  it('respects a work area offset by a taskbar or second monitor', () => {
    const secondMonitor: Rect = { x: 1920, y: 40, width: 1280, height: 1000 };
    expect(computeDockPosition(mascot(1920, 40), panel, secondMonitor)).toEqual({
      x: 1920,
      y: 248,
    });
  });

  it('pins to the work area origin when the panel is larger than the area', () => {
    const tiny: Rect = { x: 100, y: 100, width: 300, height: 300 };
    expect(computeDockPosition(mascot(150, 150), panel, tiny)).toEqual({ x: 100, y: 100 });
  });
});
