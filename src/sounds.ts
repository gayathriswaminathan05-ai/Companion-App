// Blob's voice: tiny synthesized chirps (no audio files — pure WebAudio).
// One consistent "instrument" so every sound feels like the same creature.

let enabled = true;
export function setSoundsEnabled(on: boolean) {
  enabled = on;
}
export function soundsEnabled() {
  return enabled;
}

let ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// One soft rounded note with a quick pitch slide — the core of Blob's voice.
function note(
  startFreq: number,
  endFreq: number,
  t0: number,
  dur: number,
  peak = 0.12,
  type: OscillatorType = "triangle",
) {
  const a = ac();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, a.currentTime + t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), a.currentTime + t0 + dur);
  gain.gain.setValueAtTime(0.0001, a.currentTime + t0);
  gain.gain.exponentialRampToValueAtTime(peak, a.currentTime + t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime + t0);
  osc.stop(a.currentTime + t0 + dur + 0.05);
}

export type ChirpName =
  | "hello" // cheerful two-note greeting
  | "boop" // soft single tap (menu open)
  | "celebrate" // rising happy arpeggio
  | "pop" // gentle attention blip (reminders, nudges)
  | "sleepy" // slow descending yawn-tones
  | "giggle" // fast wobbly tee-hee (joke punchline)
  | "msg"; // very quiet blip when a chat reply lands

export function chirp(name: ChirpName) {
  if (!enabled) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  try {
    switch (name) {
      case "hello":
        note(520, 660, 0, 0.12);
        note(660, 880, 0.13, 0.16);
        break;
      case "boop":
        note(440, 500, 0, 0.09, 0.09);
        break;
      case "celebrate":
        note(523, 540, 0, 0.09);
        note(659, 680, 0.09, 0.09);
        note(784, 810, 0.18, 0.14, 0.14);
        note(1046, 1080, 0.3, 0.18, 0.1, "sine");
        break;
      case "pop":
        note(600, 750, 0, 0.08, 0.1);
        note(750, 700, 0.09, 0.1, 0.07);
        break;
      case "sleepy":
        note(500, 380, 0, 0.28, 0.08);
        note(380, 260, 0.32, 0.4, 0.07);
        break;
      case "giggle":
        note(700, 900, 0, 0.07, 0.09);
        note(900, 700, 0.08, 0.07, 0.09);
        note(750, 950, 0.16, 0.07, 0.09);
        note(950, 750, 0.24, 0.09, 0.08);
        break;
      case "msg":
        note(520, 580, 0, 0.07, 0.05);
        break;
    }
  } catch {
    // audio unavailable — stay silent, never crash
  }
}
