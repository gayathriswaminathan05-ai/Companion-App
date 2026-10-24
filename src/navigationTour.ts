import type { AppData } from "./store";
import type { CharacterState } from "./character/types";
export const NAVIGATION_TOUR_VERSION = 1;
export const TOUR_STEPS = ["tasks", "voice", "breathe", "jokes", "settings"] as const;
export type TourStep = typeof TOUR_STEPS[number];
export type TourDestination = "none" | "tasks" | "breathe" | "settings" | "nap";
export const TOUR_POSES: Record<TourStep, CharacterState> = {
  tasks: "waving", voice: "waving", breathe: "meditate", jokes: "waving", settings: "waving",
};
export function needsTour(data: AppData) { return data.settings.navigationTourVersion !== NAVIGATION_TOUR_VERSION; }
export function tourStepFor(data: AppData): TourStep {
  return data.navigationTourStep && TOUR_STEPS.includes(data.navigationTourStep) ? data.navigationTourStep : "tasks";
}
export function completeTour(data: AppData): AppData {
  const next = { ...data, settings: { ...data.settings, navigationTourVersion: NAVIGATION_TOUR_VERSION } };
  delete next.navigationTourStep;
  return next;
}
