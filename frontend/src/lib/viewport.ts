/** Sync CSS viewport vars from Visual Viewport API (clavier iOS, barre d’URL, rotation). */

let initialized = false;
let rafId = 0;

export function syncVisualViewport(): void {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const layoutWidth = window.innerWidth;
  const layoutHeight = window.innerHeight;
  const visualWidth = vv?.width ?? layoutWidth;
  const visualHeight = vv?.height ?? layoutHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;

  root.style.setProperty("--vv-height", `${visualHeight}px`);
  root.style.setProperty("--vv-width", `${visualWidth}px`);
  root.style.setProperty("--vv-offset-top", `${offsetTop}px`);
  root.style.setProperty("--vv-offset-left", `${offsetLeft}px`);
  if (!root.classList.contains("chat-page")) {
    root.dataset.keyboardOpen =
      layoutHeight - offsetTop - visualHeight > 40 ? "true" : "false";
  }
  root.style.setProperty("--vh", `${visualHeight * 0.01}px`);
  root.style.setProperty("--vw", `${visualWidth * 0.01}px`);
  root.style.setProperty("--layout-height", `${layoutHeight}px`);
  root.style.setProperty("--layout-width", `${layoutWidth}px`);
  root.style.setProperty("--app-height", `${visualHeight}px`);
  root.style.setProperty("--app-width", `${visualWidth}px`);
}

/** @deprecated Alias — préférez syncVisualViewport */
export function syncViewportVars(): void {
  syncVisualViewport();
}

/** Réinitialise le viewport après fermeture d'un overlay mobile. */
export function resetViewportAfterOverlay(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  syncVisualViewport();
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    syncVisualViewport();
  });
  window.setTimeout(syncVisualViewport, 100);
}

function scheduleSync(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    syncVisualViewport();
  });
}

export function initViewport(): () => void {
  if (typeof window === "undefined") return () => {};

  syncVisualViewport();

  if (initialized) return () => {};
  initialized = true;

  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("orientationchange", scheduleSync, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleSync, { passive: true });

  return () => {
    window.removeEventListener("resize", scheduleSync);
    window.removeEventListener("orientationchange", scheduleSync);
    window.visualViewport?.removeEventListener("resize", scheduleSync);
    if (rafId) cancelAnimationFrame(rafId);
    initialized = false;
  };
}

/** Resync pendant l’animation clavier iOS (focus / blur). */
export function scheduleKeyboardViewportSync(run: () => void): () => void {
  const delays = [0, 50, 120, 200, 320, 480, 650] as const;
  const ids = delays.map((ms) => window.setTimeout(run, ms));
  return () => ids.forEach((id) => window.clearTimeout(id));
}
