/** Window and hit-area geometry shared by the main process and both renderers. */
export const OVERLAY_SIZE = { width: 200, height: 200 } as const;
export const PANEL_SIZE = { width: 380, height: 520 } as const;

/** The only part of the overlay that receives mouse input: the mascot placeholder. */
export const MASCOT_HIT_AREA = { x: 40, y: 68, width: 120, height: 120 } as const;
