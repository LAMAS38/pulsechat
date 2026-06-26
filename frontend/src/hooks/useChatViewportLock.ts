import { useEffect } from "react";
import {
  pinDocumentScroll,
  scheduleMobileChatFrameSync,
  syncMobileChatFrameAfterPaint,
  syncMobileChatFrameAndScroll,
} from "../lib/mobileChatFrame";

const MOBILE_MEDIA = "(max-width: 767px)";

const FRAME_VARS = [
  "--chat-frame-height",
  "--vv-height",
  "--vv-offset-top",
  "--vv-offset-left",
] as const;

export function useChatViewportLock(active: boolean) {
  useEffect(() => {
    if (!active || !window.matchMedia(MOBILE_MEDIA).matches) return;

    const root = document.documentElement;
    root.classList.add("chat-page");
    pinDocumentScroll();
    syncMobileChatFrameAndScroll();

    let rafId = 0;
    let cancelKeyboardSync: (() => void) | null = null;

    const sync = () => {
      syncMobileChatFrameAndScroll();
      syncMobileChatFrameAfterPaint();
    };

    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        sync();
      });
    };

    const scheduleKeyboardSync = () => {
      cancelKeyboardSync?.();
      cancelKeyboardSync = scheduleMobileChatFrameSync(sync);
    };

    const isComposeTarget = (el: EventTarget | null): el is HTMLElement =>
      el instanceof HTMLElement && Boolean(el.closest(".chat-compose-area"));

    const onComposeFocusIn = (event: FocusEvent) => {
      if (!isComposeTarget(event.target)) return;
      root.dataset.keyboardOpen = "true";
      pinDocumentScroll();
      sync();
      scheduleKeyboardSync();
    };

    const onComposeFocusOut = (event: FocusEvent) => {
      if (!isComposeTarget(event.target)) return;
      requestAnimationFrame(() => {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement && activeEl.closest(".chat-compose-area")) return;
        sync();
        scheduleKeyboardSync();
      });
    };

    const onVisualViewportScroll = () => {
      pinDocumentScroll();
      scheduleSync();
    };

    window.visualViewport?.addEventListener("resize", scheduleSync, { passive: true });
    window.visualViewport?.addEventListener("scroll", onVisualViewportScroll, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    window.addEventListener("scroll", pinDocumentScroll, { passive: true, capture: true });
    document.addEventListener("focusin", onComposeFocusIn);
    document.addEventListener("focusout", onComposeFocusOut);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      cancelKeyboardSync?.();
      root.classList.remove("chat-page");
      delete root.dataset.keyboardOpen;
      for (const prop of FRAME_VARS) {
        root.style.removeProperty(prop);
      }
      window.visualViewport?.removeEventListener("resize", scheduleSync);
      window.visualViewport?.removeEventListener("scroll", onVisualViewportScroll);
      window.removeEventListener("orientationchange", scheduleSync);
      window.removeEventListener("scroll", pinDocumentScroll, { capture: true });
      document.removeEventListener("focusin", onComposeFocusIn);
      document.removeEventListener("focusout", onComposeFocusOut);
      pinDocumentScroll();
    };
  }, [active]);
}
