export type CharacterState =
  | "idle"
  | "idlehop" // spontaneous little hop, then back to calm idle
  | "lying" // idle activity: lounging on its side
  | "hammock" // idle activity: hammock + sunglasses
  | "meditate" // idle activity: levitating meditation
  | "picnic" // idle activity: snacking from its basket
  | "groove" // idle activity: headphones, vibing to music
  | "hula" // idle activity: hula hoop
  | "sleeping"
  | "waking"
  | "waving"
  | "celebrating"
  | "writing"
  | "stretching"
  | "listening"
  | "thinking"
  | "juggling"
  | "noting"
  | "watering"
  | "dragged";

export type SproutStage = "bud" | "leaf" | "leaves" | "bloom";

export const SPROUT_STAGES: SproutStage[] = ["bud", "leaf", "leaves", "bloom"];

export const ALL_STATES: CharacterState[] = [
  "idle",
  "idlehop",
  "lying",
  "hammock",
  "meditate",
  "picnic",
  "groove",
  "hula",
  "sleeping",
  "waking",
  "waving",
  "celebrating",
  "writing",
  "stretching",
  "listening",
  "thinking",
  "juggling",
  "noting",
  "watering",
  "dragged",
];
