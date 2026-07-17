import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterState } from "./types";

// States that play once, then return to idle automatically (duration in ms).
const TIMED: Partial<Record<CharacterState, number>> = {
  idlehop: 2000, // one hop burst (24 frames at 12fps), then settle
  // Idle ACTIVITIES: he does these for a little while, then returns to calm.
  lying: 40000,
  hammock: 45000,
  meditate: 40000,
  picnic: 35000,
  groove: 30000,
  hula: 25000,
  waking: 1400,
  waving: 2200,
  celebrating: 2600,
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
