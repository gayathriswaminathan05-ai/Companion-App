import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterState } from "./types";

// States that play once, then return to idle automatically (duration in ms).
const TIMED: Partial<Record<CharacterState, number>> = {
  waking: 1400,
  waving: 2200,
  celebrating: 2600,
  writing: 3400,
  stretching: 2800,
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
