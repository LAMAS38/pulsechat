import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from "react";

const MOBILE_MEDIA = "(max-width: 767px)";

/** Panneau calé sur la zone visible iOS ; le fond plein écran est géré à part. */
export function useVisualViewportOverlay(
  enabled: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
) {
  const [top, setTop] = useState(0);

  const scrollAnchorIntoView = useCallback(() => {
    const anchor = anchorRef.current;
    const scroll = scrollRef.current;
    const vv = window.visualViewport;
    if (!anchor || !scroll || !vv) return;

    const rect = anchor.getBoundingClientRect();
    const visibleTop = vv.offsetTop + 12;
    const visibleBottom = vv.offsetTop + vv.height - 12;

    if (rect.bottom > visibleBottom) {
      scroll.scrollTop += rect.bottom - visibleBottom;
    }
    if (rect.top < visibleTop) {
      scroll.scrollTop -= visibleTop - rect.top;
    }
  }, [anchorRef, scrollRef]);

  useEffect(() => {
    if (!enabled || !window.matchMedia(MOBILE_MEDIA).matches) return;

    const sync = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setTop(vv.offsetTop);
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollAnchorIntoView);
      });
    };

    sync();
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);

    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, [enabled, scrollAnchorIntoView]);

  const panelStyle: CSSProperties | undefined = enabled
    ? {
        position: "fixed",
        top,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
      }
    : undefined;

  return { panelStyle, scrollAnchorIntoView };
}
