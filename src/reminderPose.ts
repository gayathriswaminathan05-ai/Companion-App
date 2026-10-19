import type { CharacterState } from "./character/types";

// Local, deliberately conservative matching: errands mentioning coffee or food
// still ring the bell. No model or network request is needed to choose a pose.
export function reminderPose(title: string): CharacterState {
  const text = title.trim().replace(/[.!]+$/, "");
  if (/^(?:meditat(?:e|ion|ing)\b|breathwork\b|(?:take|have|start|do|time for)\s+(?:a\s+|my\s+)?(?:meditation|breathing|breathwork)\b|breathing\s+(?:break|exercise|practice)\b)/i.test(text)) return "meditate";
  if (/^(?:(?:tea(?:\s+or\s+coffee)?|coffee|chai)(?:\s+(?:break|time))?$|(?:take|have|enjoy|drink|time for)\s+(?:(?:a|my|some)\s+)?(?:cup of\s+)?(?:tea|coffee|chai)\b)/i.test(text)) return "coffee";
  if (/^(?:(?:meal|lunch|dinner|breakfast|snack|picnic)(?:\s+(?:break|time))?$|(?:take|have|eat|time for)\s+(?:(?:a|my|some)\s+)?(?:meal|lunch|dinner|breakfast|snack)\b)/i.test(text)) return "picnic";
  return "meeting";
}
