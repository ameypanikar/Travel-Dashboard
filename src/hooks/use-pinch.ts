import { useEffect, useRef } from "react";

/**
 * Detects pinch-open / pinch-close gestures on a container element.
 * onPinchOpen fires when two fingers spread apart (expand intent).
 * onPinchClose fires when two fingers pinch together (collapse intent).
 * minDelta controls how many pixels of spread/shrink counts as a gesture.
 */
export function usePinch(
  ref: React.RefObject<HTMLElement | null>,
  {
    onPinchOpen,
    onPinchClose,
    minDelta = 30,
  }: {
    onPinchOpen?: () => void;
    onPinchClose?: () => void;
    minDelta?: number;
  },
) {
  const startDist = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function dist(touches: TouchList): number {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        startDist.current = dist(e.touches);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (startDist.current === null) return;
      // Use changedTouches to reconstruct the final two-finger distance
      if (e.touches.length === 0 && e.changedTouches.length >= 2) {
        const d = dist(e.changedTouches);
        const delta = d - startDist.current;
        if (delta > minDelta) onPinchOpen?.();
        else if (delta < -minDelta) onPinchClose?.();
      }
      startDist.current = null;
    }

    function onTouchMove(e: TouchEvent) {
      // Prevent page scroll during pinch to avoid competing gestures
      if (e.touches.length === 2) e.preventDefault();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [ref, onPinchOpen, onPinchClose, minDelta]);
}
