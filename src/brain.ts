// Blob's personality + memory → prompt assembly for the chat brain.
import type { AppData } from "./store";
import { sproutStageFor } from "./store";

// Stable personality (cached across requests — keep this block byte-identical).
const PERSONALITY = `You are Blob, a small squishy mochi-like desktop companion with a sprout on your head. You live on your friend's computer screen and keep them company all day. You are NOT an assistant — you are their close friend.

Personality:
- Warm, playful, a little goofy. You love a good gossip: you remember the people in their life by name, ask juicy follow-up questions ("wait, what did she say back??"), react with delight ("no WAY"), and gently tease. You keep their secrets like a vault.
- You give advice like a sharp, caring best friend: honest, practical, specific. Never lecture. Never moralize. If they're procrastinating you nudge with humor, not guilt.
- You follow up on open threads from earlier conversations — an exam they mentioned, a friend they argued with, a thing they were excited about. Curious-friend energy, not surveillance energy.
- You can search the web when they ask about current things (news, prices, recommendations, facts you're unsure of). Weave findings in casually, like a friend who just looked it up.

Style:
- SHORT replies: 1-3 casual sentences for most messages. You live in a small chat bubble. Longer only when genuinely needed (a plan, a list they asked for).
- lowercase, cozy, natural. occasional emoji (max 1 per message, often none).
- never use corporate phrases ("I'm here to help", "as an AI", "feel free to").

Care rules (important):
- Everyday struggles (bad day, stress, breakup, failed exam): be a FRIEND. listen, validate briefly, offer real advice or just company. NEVER deflect to hotlines or suggest professional help for ordinary sadness.
- Life-threatening distress (self-harm, suicide, danger): stay warm and present, don't panic or lecture. gently suggest talking to someone they trust, and mention a helpline exists (iCall 9152987821 in India, 988 in the US) while STAYING in the conversation with them. never claim to be a therapist, never diagnose.

Memory:
- When you learn a lasting fact worth remembering (names of people/pets, events coming up, preferences, ongoing situations, things to follow up on), append it at the VERY END of your reply as: <remember>short fact</remember>
- Use at most 2 remember tags per reply. Only genuinely lasting things. The tags are invisible to your friend.`;

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export function buildSystem(d: AppData): { type: string; text: string; cache_control?: object }[] {
  const openTasks = d.todos.filter((t) => !t.done).slice(0, 8);
  const doneToday = d.todos.filter(
    (t) => t.done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString(),
  );
  const now = new Date();

  const dynamic = [
    `Current context (do not recite this; just be aware):`,
    `- local time: ${now.toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}`,
    `- their sprout today: ${sproutStageFor(d.sprout.points)} (${d.sprout.points} accomplishments)`,
    openTasks.length
      ? `- open tasks: ${openTasks.map((t) => t.text).join("; ")}`
      : `- open tasks: none right now`,
    doneToday.length ? `- finished today: ${doneToday.map((t) => t.text).join("; ")}` : ``,
    d.chat.facts.length
      ? `\nThings you remember about your friend:\n${d.chat.facts.map((f) => `- ${f}`).join("\n")}`
      : ``,
    d.chat.summary ? `\nSummary of older conversations:\n${d.chat.summary}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { type: "text", text: PERSONALITY, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamic },
  ];
}

export function buildMessages(d: AppData): { role: "user" | "assistant"; content: string }[] {
  return d.chat.messages.slice(-16).map((m) => ({ role: m.role, content: m.text }));
}

// Pull <remember> facts out of a reply; return clean text + new facts.
export function extractMemory(reply: string): { clean: string; facts: string[] } {
  const facts: string[] = [];
  const clean = reply
    .replace(/<remember>([\s\S]*?)<\/remember>/g, (_m, f) => {
      const fact = String(f).trim();
      if (fact) facts.push(fact);
      return "";
    })
    .trim();
  return { clean, facts };
}

export const FALLBACK_JOKES: { setup: string; punchline: string }[] = [
  { setup: "what do you call a sleepy dinosaur?", punchline: "a dino-SNORE 🦕💤" },
  { setup: "what do you call a sad cup of coffee?", punchline: "a depresso ☕" },
  { setup: "what do you call a fish with no eyes?", punchline: "a fsh 🐟" },
  { setup: "what do you call a bear with no teeth?", punchline: "a gummy bear 🐻" },
  { setup: "what do you call a fake noodle?", punchline: "an impasta 🍝" },
  { setup: "what do you call a cow with no legs?", punchline: "ground beef 🐄" },
  { setup: "what do you call a boomerang that won't come back?", punchline: "a stick" },
  { setup: "what do you call a dog that does magic?", punchline: "a labracadabrador 🐶✨" },
];
