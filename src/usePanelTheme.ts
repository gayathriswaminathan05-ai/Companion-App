import { useEffect, useRef, useState } from "react";

// Panel light / dark.
// Default: follow the macOS appearance.
// With "Match what's behind me" on (opt-in, needs Screen Recording): while any
// UI is showing, read the brightness just around the companion every few
// seconds and go dark over light apps, light over dark apps. Hysteresis keeps
// it from flickering on mid-grey backgrounds. Only a number comes back from
// the main process; no image ever reaches this side.

const POLL_MS = 4000;
const TO_DARK = 0.62; // backdrop brighter than this → dark panels
const TO_LIGHT = 0.42; // backdrop darker than this → light panels

export function usePanelTheme(match: boolean, uiVisible: boolean, area: { top: number; bottom: number }) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  // Remembered between openings so the next panel opens in the right theme.
  const [backdropDark, setBackdropDark] = useState<boolean | null>(null);
  const areaRef = useRef(area);
  areaRef.current = area;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!match) {
      setBackdropDark(null);
      return;
    }
    if (!uiVisible) return;
    let alive = true;
    const check = async () => {
      let lum: number | null = null;
      try {
        lum = (await window.companion.backdropLuminance?.(areaRef.current)) ?? null;
      } catch {
        lum = null;
      }
      if (!alive || lum === null) return;
      setBackdropDark((prev) => (lum > TO_DARK ? true : lum < TO_LIGHT ? false : (prev ?? lum > 0.5)));
    };
    void check();
    const id = window.setInterval(check, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [match, uiVisible]);

  const dark = match && backdropDark !== null ? backdropDark : systemDark;
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
}
