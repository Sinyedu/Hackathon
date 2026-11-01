import { useRef, type PointerEvent } from 'react';

const CLICK_TOLERANCE_PX = 4;

interface Gesture {
  startX: number;
  startY: number;
  moved: boolean;
}

/** Drag the overlay window by the mascot; a gesture that barely moves counts as a click. */
export function useMascotDrag(onClick: () => void) {
  const gesture = useRef<Gesture | null>(null);

  return {
    onPointerEnter: () => window.kiwi.overlay.setInteractive(true),
    onPointerLeave: () => {
      if (!gesture.current) window.kiwi.overlay.setInteractive(false);
    },
    onPointerDown(event: PointerEvent<HTMLElement>) {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { startX: event.screenX, startY: event.screenY, moved: false };
      window.kiwi.overlay.dragStart();
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const active = gesture.current;
      if (!active) return;
      const dx = event.screenX - active.startX;
      const dy = event.screenY - active.startY;
      if (Math.hypot(dx, dy) > CLICK_TOLERANCE_PX) active.moved = true;
      if (active.moved) window.kiwi.overlay.dragMove({ dx, dy });
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const active = gesture.current;
      gesture.current = null;
      if (!active) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      window.kiwi.overlay.dragEnd();
      if (!active.moved) onClick();
    },
  };
}
