import type { AppData, Settings } from "./store";

export const ONBOARDING_VERSION = 1;
export const SETUP_STEPS = ["name", "water", "movement", "meditation", "meal", "coffee", "bedtime", "microphone", "ready"] as const;
export type SetupStep = typeof SETUP_STEPS[number];
export type ScheduledCare = "meditation" | "meal" | "coffee";
export const CARE_TITLES: Record<ScheduledCare, string> = {
  meditation: "Meditation break", meal: "Meal break", coffee: "Tea or coffee break",
};
export interface SetupProgress {
  step: SetupStep;
  name: string;
  waterMins: number;
  movementMins: number;
  movementStyle: Settings["movementStyle"];
  bedtime: string | null;
  times: Record<ScheduledCare, string | null>;
}

export function needsSetup(data: AppData): boolean {
  return data.settings.onboardingVersion !== ONBOARDING_VERSION;
}

export function nextDailyTime(time: string, now = new Date()): Date {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid time.");
  const [h, m] = time.split(":").map(Number);
  const date = new Date(now);
  date.setHours(h, m, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}

export function newSetup(data: AppData): SetupProgress {
  const existing = data.settings.welcomed;
  const times: SetupProgress["times"] = { meditation: null, meal: null, coffee: null };
  for (const task of data.todos) {
    if (!task.wellnessKind || !task.due || task.done) continue;
    const d = new Date(task.due);
    if (Number.isFinite(d.getTime())) times[task.wellnessKind] = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return {
    step: "name", name: data.settings.companionName || "Blob",
    waterMins: existing && data.settings.waterNudge ? data.settings.waterMins : 0,
    movementMins: existing ? data.settings.breakMins : 0,
    movementStyle: data.settings.movementStyle || "mixed",
    bedtime: existing ? data.settings.bedtime : null, times,
  };
}

/** A draft is local and resumable. It never activates reminders. */
export function setupFor(data: AppData): SetupProgress {
  const saved = data.setup;
  if (!saved || !SETUP_STEPS.includes(saved.step)) return newSetup(data);
  return { ...newSetup(data), ...saved, times: { ...newSetup(data).times, ...saved.times } };
}

/** Apply once, without touching unrelated tasks or historical personal data. */
export function completeSetup(data: AppData, draft: SetupProgress, now = new Date()): AppData {
  const next = structuredClone(data);
  const times = Object.entries(draft.times) as [ScheduledCare, string | null][];
  const scheduled = times.filter(([, time]) => time !== null).map(([kind, time]) => ({kind, due: nextDailyTime(time!, now)}));
  if (draft.bedtime !== null) nextDailyTime(draft.bedtime, now);
  next.settings = { ...next.settings,
    companionName: draft.name.trim().slice(0, 30) || data.settings.companionName,
    waterNudge: draft.waterMins > 0, waterMins: draft.waterMins || 120,
    breakMins: draft.movementMins, movementStyle: draft.movementStyle,
    bedtime: draft.bedtime, welcomed: true, onboardingVersion: ONBOARDING_VERSION,
  };
  // Only the setup's own reminders are replaced on a later review of setup.
  next.todos = next.todos.filter(t => !t.wellnessKind || t.done);
  for (const {kind, due} of scheduled) next.todos.push({
    id: `care-${kind}-${crypto.randomUUID()}`, wellnessKind: kind, text: CARE_TITLES[kind],
    done: false, recurring: "daily", createdAt: now.toISOString(), due: due.toISOString(), firedAt: null,
  });
  // Starting after tonight's bedtime must not immediately produce a bedtime alert.
  if (draft.bedtime) {
    const [h, m] = draft.bedtime.split(":").map(Number);
    if (now.getHours() * 60 + now.getMinutes() >= h * 60 + m) next.wellness.bedtimeDate = next.wellness.date;
  }
  delete next.setup;
  return next;
}
