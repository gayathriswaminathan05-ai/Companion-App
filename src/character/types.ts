export type CharacterState =
  | "idle"
  | "sleeping"
  | "waking"
  | "waving"
  | "celebrating"
  | "writing"
  | "stretching"
  | "listening"
  | "thinking"
  | "dragged";

export type SproutStage = "bud" | "leaf" | "leaves" | "bloom";

export const SPROUT_STAGES: SproutStage[] = ["bud", "leaf", "leaves", "bloom"];

export const ALL_STATES: CharacterState[] = [
  "idle",
  "sleeping",
  "waking",
  "waving",
  "celebrating",
  "writing",
  "stretching",
  "listening",
  "thinking",
  "dragged",
];
