// A one-minute, nonclinical breathing break. No holds or personal data.
export const BREATHING_DURATION_MS = 60_000;
// Scripted, bundled audio: no live AI or speech service is needed to meditate.
// Build with scripts/build-breathing-audio.mjs; times match the visual phases.
export const BREATHING_VOICE_CUES = {
  guided: [
    { at: 0, text: "Settle in. Let your shoulders soften." },
    ...Array.from({ length: 6 }, (_, cycle) => [
      { at: 5 + cycle * 8, text: "Breathe in gently." },
      { at: 9 + cycle * 8, text: "And breathe out." },
    ]).flat(),
    { at: 53, text: "Let your breath find its own rhythm. A little room, just for you." },
  ],
  ownPace: [
    { at: 0, text: "Settle in. Breathe at your own pace." },
    { at: 17, text: "Let your shoulders soften. No need to change your breath." },
    { at: 37, text: "Nothing to get right. Just a quiet moment together." },
    { at: 53, text: "Keep your own gentle rhythm. This little moment was yours." },
  ],
};
export function breathingStep(elapsedMs: number) {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed >= BREATHING_DURATION_MS) return { phase: "done", label: "A little room for you.", remaining: 0 };
  const remaining = Math.ceil((BREATHING_DURATION_MS - elapsed) / 1000);
  if (elapsed < 5000) return { phase: "settle", label: "Settle in. Let your shoulders soften.", remaining };
  if (elapsed >= 53000) return { phase: "finish", label: "Let your breath find its own rhythm.", remaining };
  const inhale = (elapsed - 5000) % 8000 < 4000;
  return { phase: inhale ? "in" : "out", label: inhale ? "Breathe in gently" : "Breathe out gently", remaining };
}
