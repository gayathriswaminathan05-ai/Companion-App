// Natural-language reminder parsing ("call amma at 6pm", "stretch every day at 11",
// "take the cake out in 40 minutes") using chrono-node. Works fully offline.
import * as chrono from "chrono-node";

export interface ParsedReminder {
  title: string;
  due: Date;
  recurring?: "daily";
}

export function parseReminder(input: string): ParsedReminder | null {
  let text = input.trim();
  if (!text) return null;

  let recurring: "daily" | undefined;
  const daily = /\b(every\s?day|daily|everyday)\b/i;
  if (daily.test(text)) {
    recurring = "daily";
    text = text.replace(daily, "").trim();
  }

  const results = chrono.parse(text, new Date(), { forwardDate: true });
  if (results.length === 0) return null;

  const r = results[0];
  const due = r.start.date();

  let title = (text.slice(0, r.index) + text.slice(r.index + r.text.length)).trim();
  title = title
    .replace(/^(please\s+)?(remind\s+me\s+(to|about)?|remember\s+(to)?)\s*/i, "")
    .replace(/\b(at|by|on|in)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.,;]\s*$/, "")
    .trim();
  if (!title) title = "your reminder";

  return { title, due, recurring };
}

// Parse just a time phrase ("tomorrow 8am", "in 2 hours") — for editing.
export function parseWhen(input: string): Date | null {
  const results = chrono.parse(input.trim(), new Date(), { forwardDate: true });
  return results.length ? results[0].start.date() : null;
}

// Clean a task title out of free text (used when no time was given).
export function cleanTitle(input: string): string {
  return input
    .trim()
    .replace(/^(please\s+)?(remind\s+me\s+(to|about)?|remember\s+(to)?)\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.,;]\s*$/, "")
    .trim();
}

// Friendly default times for "no time given" quick-picks.
export function quickPicks(): { label: string; due: Date }[] {
  const inAnHour = new Date(Date.now() + 60 * 60 * 1000);
  const evening = new Date();
  evening.setHours(18, 0, 0, 0);
  if (evening.getTime() < Date.now()) evening.setDate(evening.getDate() + 1);
  const tomorrow9 = new Date();
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);
  return [
    { label: "in 1 hour", due: inAnHour },
    { label: evening.getDate() === new Date().getDate() ? "this evening 6pm" : "tomorrow evening 6pm", due: evening },
    { label: "tomorrow 9am", due: tomorrow9 },
  ];
}

export function formatDue(due: Date): string {
  const now = new Date();
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = due.toDateString() === now.toDateString();
  if (sameDay) return `today ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
  return `${due.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}
