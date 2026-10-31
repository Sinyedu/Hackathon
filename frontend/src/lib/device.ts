/** Phones and tablets: the file picker offers the camera, and the QR pairing card is pointless. */
export const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
