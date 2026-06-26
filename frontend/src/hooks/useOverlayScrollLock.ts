import { useEffect } from "react";

/** Bloque le scroll sans position:fixed sur body (compatible clavier iOS). */
export function useOverlayScrollLock(locked: boolean, className = "overlay-scroll-lock") {
  useEffect(() => {
    if (!locked) return;

    const html = document.documentElement;
    html.classList.add(className);

    return () => {
      html.classList.remove(className);
    };
  }, [locked, className]);
}
