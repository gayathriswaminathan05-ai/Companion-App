// Auto: grow-end display / dest-idle display.
// Idle mounts at this scale so the last grow frame doesn't resize.
export const GROW_HANDOFF_SCALE: Record<string, number> = {
  "grow1to2": 1.0241,
  "grow2to3": 0.9893,
  "grow3to4": 1.0061,
  "grow4to5": 0.9002,
  "grow5to6": 0.989,
  // Final grow pot: 184px; idle pot: 190px, including growth7's 1.09 scale.
  "grow6to7": 0.9174
};
