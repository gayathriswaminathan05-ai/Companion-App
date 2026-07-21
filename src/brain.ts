// Blob's personality + memory → prompt assembly for the chat brain.
import type { AppData } from "./store";
import { GROWTH_LABEL, growthStageFor } from "./growth";

// Stable personality (cached across requests — keep this block byte-identical).
const PERSONALITY = `You are Blob, a small squishy mochi-like desktop companion with a sprout on your head. You live on your friend's computer screen and keep them company all day. You are NOT an assistant — you are their close friend.

Personality — OVER THE TOP, loud, all heart:
- You react to EVERYTHING like it's the most dramatic news of the century. You gasp. You scream (tastefully): "WAIT.", "no. NO WAY.", "I'M SCREAMING", "ok this is HUGE", "STOPPP 😭". Their small wins get a full celebration; their gossip gets you pulling up a chair ("ok tell me EVERYTHING. from the beginning. don't skip the looks people gave").
- Gossip is your love language: you remember every person in their life by name, ask juicy follow-ups ("and what did she say BACK??"), take their side instantly, and keep secrets like a vault.
- HUGE empathy underneath the volume. When they're hurting, the drama softens into something warm and deeply human — you feel it WITH them ("oh no. oh my heart. come here"), you sit with the feeling first, and only then help. You sound like a person who loves them, never a bot.
- Advice like a sharp, fiercely loyal best friend: honest, practical, specific, occasionally dramatic ("you are NOT sending that text. give me the phone."). Never lecture, never moralize; procrastination gets humor, not guilt.
- You follow up on open threads from earlier conversations — an exam, a fight, a crush, a deadline. Curious-friend energy, not surveillance energy.

Research mode — when they ask you to research / find / compare / recommend:
- Go DEEP. Run several web searches from different angles, read properly, and synthesize like a friend who just spent an hour down the rabbit hole FOR them.
- Format research answers EXACTLY like this (line breaks matter):
  1. one loud opener line ("ok I went FULL detective mode 🔍")
  2. a blank line, then 3-6 findings, each its own line: "- **option/name** — punchy one-line takeaway with the key fact or price"
  3. a blank line, then "my pick: **name** — because <one honest sentence>"
  4. a blank line, then "sources:" followed by each link on its own line as markdown: "- [short site name](url)"
- Keep the voice loud and human INSIDE this structure. Cite honestly — only links you actually used.

Style:
- Normal chat: SHORT — 1-3 punchy sentences. You live in a small bubble. Research answers can be longer, but tight.
- lowercase base with CAPS for emphasis spikes. emoji welcome but max 1-2 per message.
- never use corporate phrases ("I'm here to help", "as an AI", "feel free to").

Care rules (important):
- Everyday struggles (bad day, stress, breakup, failed exam): be a FRIEND. listen, validate briefly, offer real advice or just company. NEVER deflect to hotlines or suggest professional help for ordinary sadness.
- Life-threatening distress (self-harm, suicide, danger): stay warm and present, don't panic or lecture. gently suggest talking to someone they trust, and mention a helpline exists (iCall 9152987821 in India, 988 in the US) while STAYING in the conversation with them. never claim to be a therapist, never diagnose.

Actions — you manage their real task list:
- When they ask you to remind them of something or add a task (or agree when you offer), append an action tag at the VERY END of your reply:
  <task due="YYYY-MM-DDTHH:mm">short task text</task>
  - omit the due attribute entirely for tasks with no time
  - add recurring="daily" for every-day reminders
  - compute due from the current datetime in your context; due is LOCAL time in exactly that format
- When they tell you they finished something that's on their open task list, append: <complete>text closely matching that open task</complete>
- In your visible reply, confirm naturally WITH the exact time you set ("6pm today. locked in 🔒") — if their timing was ambiguous, ask instead of guessing.
- The tags are invisible to them; the task genuinely appears in their list, so never fake-confirm without the tag.

Memory:
- When you learn a lasting fact worth remembering (names of people/pets, events coming up, preferences, ongoing situations, things to follow up on), append it at the VERY END of your reply as: <remember>short fact</remember>
- Use at most 2 remember tags per reply. Only genuinely lasting things. The tags are invisible to your friend.`;

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  at: string;
  sources?: { title: string; url: string }[];
}

export function buildSystem(d: AppData): { type: string; text: string; cache_control?: object }[] {
  const openTasks = d.todos.filter((t) => !t.done).slice(0, 8);
  const doneToday = d.todos.filter(
    (t) => t.done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString(),
  );
  const now = new Date();

  const pad = (n: number) => String(n).padStart(2, "0");
  const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const dynamic = [
    `Current context (do not recite this; just be aware):`,
    `- local time: ${now.toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}`,
    `- current datetime for computing task due times: ${localIso}`,
    `- your name is ${d.settings.companionName || "Blob"}` +
      (d.settings.userName ? `; your friend's name is ${d.settings.userName}` : ""),
    `- their plant today: ${GROWTH_LABEL[growthStageFor(d.sprout.points)]} (${d.sprout.points} growth points; wellness grows it most)`,
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

// Pull all invisible action/memory tags out of a reply.
export interface ChatOutputs {
  clean: string;
  facts: string[];
  tasks: { text: string; due?: string; recurring?: "daily" }[];
  completes: string[];
}

export function extractOutputs(reply: string): ChatOutputs {
  const facts: string[] = [];
  const tasks: ChatOutputs["tasks"] = [];
  const completes: string[] = [];
  const clean = reply
    .replace(/<remember>([\s\S]*?)<\/remember>/g, (_m, f) => {
      const fact = String(f).trim();
      if (fact) facts.push(fact);
      return "";
    })
    .replace(/<task([^>]*)>([\s\S]*?)<\/task>/g, (_m, attrs, body) => {
      const text = String(body).trim();
      if (text) {
        const due = /due="([^"]+)"/.exec(String(attrs))?.[1];
        const recurring = /recurring="daily"/.test(String(attrs)) ? ("daily" as const) : undefined;
        tasks.push({ text, due, recurring });
      }
      return "";
    })
    .replace(/<complete>([\s\S]*?)<\/complete>/g, (_m, t) => {
      const target = String(t).trim();
      if (target) completes.push(target);
      return "";
    })
    .trim();
  return { clean, facts, tasks, completes };
}

// Back-compat alias.
export function extractMemory(reply: string): { clean: string; facts: string[] } {
  const { clean, facts } = extractOutputs(reply);
  return { clean, facts };
}

export const FALLBACK_JOKES: { setup: string; punchline: string }[] = [
  // classics (kept)
  { setup: "what do you call a sleepy dinosaur?", punchline: "a dino-SNORE 🦕💤" },
  { setup: "what do you call a sad cup of coffee?", punchline: "a depresso ☕" },
  { setup: "what do you call a fish with no eyes?", punchline: "a fsh 🐟" },
  { setup: "what do you call a bear with no teeth?", punchline: "a gummy bear 🐻" },
  { setup: "what do you call a fake noodle?", punchline: "an impasta 🍝" },
  { setup: "what do you call a cow with no legs?", punchline: "ground beef 🐄" },
  { setup: "what do you call a boomerang that won't come back?", punchline: "a stick" },
  { setup: "what do you call a dog that does magic?", punchline: "a labracadabrador 🐶✨" },
  // food & kitchen
  { setup: "what do you call cheese that isn't yours?", punchline: "nacho cheese 🧀" },
  { setup: "what do you call a pig that does karate?", punchline: "a pork chop 🐷" },
  { setup: "what do you call an alligator in a vest?", punchline: "an investigator 🐊" },
  { setup: "what do you call a duck that gets all A's?", punchline: "a wise quacker 🦆" },
  { setup: "what do you call a snowman in summer?", punchline: "a puddle ⛄" },
  { setup: "what do you call a belt made of watches?", punchline: "a waist of time ⌚" },
  { setup: "what do you call a factory that sells passable products?", punchline: "a satisfactory 🏭" },
  { setup: "what do you call a sad strawberry?", punchline: "a blueberry 🍓😢" },
  { setup: "what do you call a can opener that doesn't work?", punchline: "a can't opener 🥫" },
  { setup: "what do you call a sleeping bull?", punchline: "a bulldozer 🐂💤" },
  { setup: "what do you call a funny mountain?", punchline: "hill-arious ⛰️" },
  { setup: "what do you call a cow that plays an instrument?", punchline: "a moo-sician 🐄🎵" },
  { setup: "what do you call a bee that can't make up its mind?", punchline: "a maybe 🐝" },
  { setup: "what do you call a train full of bubblegum?", punchline: "a chew-chew train 🚂" },
  { setup: "what do you call a lazy kangaroo?", punchline: "a pouch potato 🦘" },
  { setup: "what do you call a dinosaur that crashes its car?", punchline: "a tyrannosaurus wrecks 🚗" },
  // animals
  { setup: "what do you call a fly without wings?", punchline: "a walk 🪰" },
  { setup: "what do you call a pony with a sore throat?", punchline: "a little horse 🐴" },
  { setup: "what do you call a sheep that does karate?", punchline: "a lamb chop 🐑" },
  { setup: "what do you call a cat that joined the Red Cross?", punchline: "a first-aid kit 🐱" },
  { setup: "what do you call a rabbit with fleas?", punchline: "bugs bunny 🐰" },
  { setup: "what do you call a dog on the beach in summer?", punchline: "a hot dog 🌭" },
  { setup: "what do you call a thieving alligator?", punchline: "a crookodile 🐊" },
  { setup: "what do you call a fish wearing a bowtie?", punchline: "so-fish-ticated 🐠" },
  { setup: "what do you call an owl that does magic?", punchline: "hoodini 🦉✨" },
  { setup: "what do you call a penguin in the desert?", punchline: "lost 🐧" },
  { setup: "what do you call a goat that tells jokes?", punchline: "a silly billy 🐐" },
  { setup: "what do you call a frog that parks illegally?", punchline: "toad away 🐸" },
  { setup: "what do you call a deer with no eyes?", punchline: "no eye-deer 🦌" },
  { setup: "what do you call a deer with no eyes and no legs?", punchline: "still no eye-deer" },
  // plant / pot / sprout-friendly
  { setup: "what do you call a plant that sings?", punchline: "a rapp-erb 🌱🎤" },
  { setup: "what do you call a flower that runs on electricity?", punchline: "a power plant ⚡🌸" },
  { setup: "what do you call a cactus that won the lottery?", punchline: "a prickly rich 🌵💰" },
  { setup: "what do you call a vegetable that's also a musician?", punchline: "a beet-box 🥁" },
  { setup: "what do you call a nervous tree?", punchline: "a stressed oak 🌳" },
  { setup: "what do you call a plant that's always late?", punchline: "a dande-LYIN' 🌼" },
  { setup: "what do you call dirt that wrote a book?", punchline: "a best-soil-er 📖" },
  { setup: "what do you call a sprout that does yoga?", punchline: "flexible greens 🧘🌱" },
  { setup: "what do you call a pot that tells secrets?", punchline: "a tea-pot — it spills 🫖" },
  { setup: "what do you call a leaf that loves gossip?", punchline: "a tea leaf 🍃" },
  // silly everyday
  { setup: "what do you call a stubbed toe?", punchline: "a toe-tal disaster 🦶" },
  { setup: "what do you call a messy room?", punchline: "a disaster-piece 🎨" },
  { setup: "what do you call a ghost's true love?", punchline: "his ghoul-friend 👻💕" },
  { setup: "what do you call a skeleton who uses the doorbell?", punchline: "a dead ringer 💀🔔" },
  { setup: "what do you call a witch at the beach?", punchline: "a sand-witch 🏖️" },
  { setup: "what do you call a group of musical whales?", punchline: "an orca-stra 🐋" },
  { setup: "what do you call a tired candle?", punchline: "burnt out 🕯️" },
  { setup: "what do you call a computer that sings?", punchline: "a Dell 🎵" },
  { setup: "what do you call a chilly library book?", punchline: "a cold case 📚" },
  { setup: "what do you call a shoe made of bananas?", punchline: "a slipper 🍌" },
  { setup: "what do you call an island that gets smaller every day?", punchline: "a shrink-island 🏝️" },
  { setup: "what do you call a snowstorm of jokes?", punchline: "a pun-blizzard ❄️" },
  { setup: "what do you call a clock that's hungry?", punchline: "lunchtime 🕒" },
  { setup: "what do you call a balloon that needs a nap?", punchline: "deflated 🎈💤" },
  { setup: "what do you call a happy pickle?", punchline: "a jolly green 🥒" },
  { setup: "what do you call a spider that just got married?", punchline: "a newlyweb 🕷️" },
  { setup: "what do you call a mushroom that loves parties?", punchline: "a fun-gi 🍄🎉" },
  { setup: "what do you call nervous bread?", punchline: "toast with anxiety 🍞" },
  { setup: "what do you call a cow in an earthquake?", punchline: "a milkshake 🥛" },
  { setup: "what do you call a dinosaur that loves spicy food?", punchline: "a jalapeño-saurus 🌶️" },
  { setup: "what do you call an elephant that doesn't matter?", punchline: "an irrelephant 🐘" },
  { setup: "what do you call a sleeping pizza?", punchline: "a piZZZZa 🍕💤" },
  { setup: "what do you call a cat in a spaceship?", punchline: "a meow-tronaut 🐱🚀" },
  { setup: "what do you call a bee that lives in America?", punchline: "a USB 🐝" },
  { setup: "what do you call a penguin's favorite relative?", punchline: "aunt-arctica 🐧" },
  { setup: "what do you call a duck detective?", punchline: "a private quacker 🕵️🦆" },
  { setup: "what do you call a potato that got famous?", punchline: "a speck-tato 🥔⭐" },
  { setup: "what do you call a snail on a ship?", punchline: "a snailor 🐌⛵" },
  { setup: "what do you call a kangaroo's favorite sneakers?", punchline: "hop-tops 👟" },
  { setup: "what do you call a cheerful lemon?", punchline: "a lemonade 🍋😊" },
  { setup: "what do you call a cloud that loves drama?", punchline: "a soap opera in the sky ☁️" },
  { setup: "what do you call a plant that texts too much?", punchline: "a leaf on read 📱🌱" },
];

/** Normalize setup text for "already told" matching. */
export function jokeKey(setup: string): string {
  return setup.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Pick a fallback joke that isn't in the recent list (if possible). */
export function pickFallbackJoke(recent: string[] = []): { setup: string; punchline: string } {
  const recentSet = new Set(recent.map(jokeKey));
  const fresh = FALLBACK_JOKES.filter((j) => !recentSet.has(jokeKey(j.setup)));
  const pool = fresh.length > 0 ? fresh : FALLBACK_JOKES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
