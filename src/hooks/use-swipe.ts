import { useEffect, useRef } from "react";

/**
 * Detects horizontal swipe gestures on a container element and calls
 * onSwipeLeft / onSwipeRight. Only fires if the horizontal distance
 * is larger than vertical (i.e. intentional horizontal swipe, not scroll).
 */
export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  {
    onSwipeLeft,
    onSwipeRight,
    minDistance = 50,
  }: {
    onSwipeLeft?: (e: TouchEvent) => void;
    onSwipeRight?: (e: TouchEvent) => void;
    minDistance?: number;
  },
) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isMultiTouch = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (localStorage.getItem("enableSwipe") === "false") {
        startX.current = null;
        startY.current = null;
        isMultiTouch.current = false;
        return;
      }
      if (e.touches.length > 1) {
        // Multi-touch detected (e.g. pinch to zoom) - ignore swipe completely
        isMultiTouch.current = true;
        startX.current = null;
        startY.current = null;
        return;
      }
      if ((e.target as Element).closest('[data-no-swipe="true"]')) {
        startX.current = null;
        startY.current = null;
        return;
      }
      isMultiTouch.current = false;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 1) {
        isMultiTouch.current = true;
        startX.current = null;
        startY.current = null;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (isMultiTouch.current) {
        if (e.touches.length === 0) {
          isMultiTouch.current = false;
        }
        startX.current = null;
        startY.current = null;
        return;
      }
      if (e.touches.length > 0 || e.changedTouches.length !== 1) {
        startX.current = null;
        startY.current = null;
        return;
      }
      if (startX.current === null || startY.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      
      // Check if swipe is globally disabled in settings
      if (localStorage.getItem("enableSwipe") === "false") {
        startX.current = null;
        startY.current = null;
        return;
      }

      // Only trigger if horizontal movement dominates
      if (Math.abs(dx) < minDistance || Math.abs(dy) > Math.abs(dx) * 0.8) return;
      if (dx < 0) onSwipeLeft?.(e);
      else onSwipeRight?.(e);
      startX.current = null;
      startY.current = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onSwipeLeft, onSwipeRight, minDistance]);
}
