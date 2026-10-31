/** Window and hit-area geometry shared by the main process and both renderers. */
export const OVERLAY_SIZE = { width: 200, height: 200 } as const;
export const PANEL_SIZE = { width: 380, height: 520 } as const;

/** The only part of the overlay that receives mouse input: the mascot placeholder. */
export const MASCOT_HIT_AREA = { x: 30, y: 30, width: 140, height: 140 } as const;
