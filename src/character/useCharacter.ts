import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterState } from "./types";

// States that play once, then return to idle automatically (duration in ms).
const TIMED: Partial<Record<CharacterState, number>> = {
  idlehop: 2000, // one hop burst (24 frames at 12fps), then settle
  // Idle ACTIVITIES: App rotates these every 10 min as the resting default —
  // no auto-return here so the pose sticks until the next swap (or interrupt).
  waking: 1400,
  waving: 2200,
  celebrating: 1400, // trimmed open+spray+laugh (~1.3s at 18fps)
  laughing: 3400, // full party laugh for jokes (~3.4s at 18fps)
  writing: 3400,
  stretching: 5200, // full follow-along routine (5s clip)
  juggling: 750,
};

export function useCharacter() {
  const [state, setState] = useState<CharacterState>("idle");
  const timer = useRef<number | null>(null);

  const set = useCallback((next: CharacterState) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setState(next);
    const duration = TIMED[next];
    if (duration) {
      timer.current = window.setTimeout(() => {
        setState("idle");
        timer.current = null;
      }, duration);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { state, set };
}
