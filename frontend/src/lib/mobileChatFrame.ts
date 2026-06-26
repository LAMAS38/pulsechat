/** Sync mobile chat frame vars (Visual Viewport — clavier iOS). */

const KEYBOARD_GAP_THRESHOLD = 40;

export const CHAT_MOBILE_FRAME_SYNC = "chat-mobile-frame-sync";

function isComposeFocused(): boolean {
  return Boolean(document.activeElement?.closest(".chat-compose-area"));
}

export function syncMobileChatFrame(): void {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) return;

  const visualH = vv.height;
  const offsetTop = vv.offsetTop;
  const offsetLeft = vv.offsetLeft;
  const layoutH = window.innerHeight;
  const keyboardGap = layoutH - offsetTop - visualH;
  const composeFocused = isComposeFocused();

  root.style.setProperty("--vv-height", `${visualH}px`);
  root.style.setProperty("--vv-offset-top", `${offsetTop}px`);
  root.style.setProperty("--vv-offset-left", `${offsetLeft}px`);
  root.style.setProperty("--chat-frame-height", `${Math.round(visualH)}px`);
  root.dataset.keyboardOpen =
    keyboardGap > KEYBOARD_GAP_THRESHOLD || composeFocused ? "true" : "false";
}

export function pinDocumentScroll(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

const KEYBOARD_SYNC_MS = [0, 50, 120, 220, 360, 520, 700, 900, 1200, 1500] as const;

export function scheduleMobileChatFrameSync(run: () => void): () => void {
  const ids = KEYBOARD_SYNC_MS.map((ms) => window.setTimeout(run, ms));
  return () => ids.forEach((id) => window.clearTimeout(id));
}

export function scrollChatToBottom(force = false, threshold = 96): void {
  const scroll = document.querySelector<HTMLElement>(".chat-scroll");
  if (!scroll) return;

  if (!force && !isComposeFocused()) {
    const distance = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
    if (distance > threshold) return;
  }

  scroll.scrollTop = scroll.scrollHeight;
}

export function syncMobileChatFrameAndScroll(): void {
  pinDocumentScroll();
  syncMobileChatFrame();
  scrollChatToBottom(isComposeFocused());
  window.dispatchEvent(new CustomEvent(CHAT_MOBILE_FRAME_SYNC));
}

export function syncMobileChatFrameAfterPaint(): void {
  requestAnimationFrame(() => {
    pinDocumentScroll();
    syncMobileChatFrame();
    scrollChatToBottom(isComposeFocused());
    window.dispatchEvent(new CustomEvent(CHAT_MOBILE_FRAME_SYNC));
  });
}
