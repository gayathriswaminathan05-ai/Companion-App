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
  | "meeting" // calendar alert: rings a handheld bell
  | "celebrating"
  | "laughing" // joke punchline — party laugh clip
  | "writing"
  | "stretching"
  | "listening"
  | "thinking"
  | "coffee" // chat open: sit & sip
  | "juggling"
  | "noting"
  | "watering"
  | "dragged"
  // Growth level-up transitions: clap celebration, then leaves grow to next stage.
  | "grow1to2"
  | "grow2to3"
  | "grow3to4"
  | "grow4to5"
  | "grow5to6";

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
  "meeting",
  "celebrating",
  "laughing",
  "writing",
  "stretching",
  "listening",
  "thinking",
  "coffee",
  "juggling",
  "noting",
  "watering",
  "dragged",
];
