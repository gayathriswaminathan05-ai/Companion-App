import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterState } from "./types";

// States that play once, then return to idle automatically (duration in ms).
const TIMED: Partial<Record<CharacterState, number>> = {
  idlehop: 1600, // one hop burst, then settle
  // Idle ACTIVITIES: App rotates these every 10 min as the resting default —
  // no auto-return here so the pose sticks until the next swap (or interrupt).
  waking: 1100,
  waving: 1700,
  meeting: 4200, // handbell ring oneshot (per-stage clips ~3–4s)
  celebrating: 3200, // per-stage cork-pull + foam: 48 frames @ 16fps (3.0s)
  laughing: 2800,
  writing: 2800,
  // Per-stage stretch→walk: stage1≈5s, stage3+≈10s; holdLast freezes short clips.
  stretching: 10500,
  watering: 2000, // pour-only trim (~1.5–1.9s @ 12fps)
  juggling: 600,
  // Growth level-up: ~61 frames @ 20fps (~3.05s) + hold on idle-matched
  // end frames so we never cut mid-settle (end flash).
  grow1to2: 3800,
  grow2to3: 3800,
  grow3to4: 3800,
  grow4to5: 3800,
  grow5to6: 3800,
  grow6to7: 3800, // crouch → jump → bushier + five flowers (jump peak frames cut)
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
