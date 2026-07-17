// App data: shape + load/save through the main process (one JSON file on disk).

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
  // Optional time: a task with `due` also fires a reminder bubble.
  due?: string | null;
  recurring?: "daily";
  firedAt?: string | null;
}

export interface Reminder {
  id: string;
  text: string;
  due: string; // ISO
  recurring?: "daily";
  firedAt?: string | null;
  createdAt: string;
}

export interface Settings {
  soundsOn: boolean;
  breakMins: number; // stretch nudge interval; 0 = off
  bedtime: string | null; // "HH:MM" 24h, null = off
  waterNudge: boolean; // every ~2h of activity, off by default
  companionName: string;
  userName: string;
  jokeEvery: "off" | "often" | "rare"; // often=3h, rare=6h
  autoHideOnCalls: boolean;
  plantScale: number; // visual size of the plant (0.6–1.2); default 1
  panelScale: number; // chat/tasks/settings height+width (0.85–1.45); default 1
}

export interface Wellness {
  date: string;
  proactive: number; // nudges shown today (hard cap)
  lastNudgeAt: string | null;
  bedtimeDate: string | null; // bedtime care already shown for this date
}

export interface ChatState {
  messages: { role: "user" | "assistant"; text: string; at: string; sources?: { title: string; url: string }[] }[];
  facts: string[]; // lasting memory about the user
  summary: string; // compressed older history
  jokeLastAt: string | null;
}

export interface AppData {
  todos: Todo[];
  reminders: Reminder[];
  // Sprout progress for TODAY. Only ever grows; resets fresh each morning.
  sprout: { date: string; points: number };
  settings: Settings;
  wellness: Wellness;
  chat: ChatState;
}

export const defaultSettings = (): Settings => ({
  soundsOn: true,
  breakMins: 60,
  bedtime: "23:00",
  waterNudge: false,
  companionName: "Blob",
  userName: "",
  jokeEvery: "often",
  autoHideOnCalls: true,
  plantScale: 1,
  panelScale: 1,
});

export const emptyWellness = (): Wellness => ({
  date: today(),
  proactive: 0,
  lastNudgeAt: null,
  bedtimeDate: null,
});

export const emptyChat = (): ChatState => ({
  messages: [],
  facts: [],
  summary: "",
  jokeLastAt: null,
});

export const emptyData = (): AppData => ({
  todos: [],
  reminders: [],
  sprout: { date: today(), points: 0 },
  settings: defaultSettings(),
  wellness: emptyWellness(),
  chat: emptyChat(),
});

export function today(): string {
  // Day boundary at 4am (Finch pattern): 1am wins still count as "today".
  const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function loadData(): Promise<AppData> {
  const raw = (await window.companion.dataLoad()) as AppData | null;
  const data = raw ?? emptyData();
  if (!data.sprout || data.sprout.date !== today()) {
    data.sprout = { date: today(), points: 0 }; // new day, new sprout
  }
  if (!Array.isArray(data.todos)) data.todos = [];
  if (!Array.isArray(data.reminders)) data.reminders = [];
  data.settings = { ...defaultSettings(), ...(data.settings ?? {}) };
  // Clamp plant size in case older/corrupt data has a wild value.
  const s = Number(data.settings.plantScale);
  data.settings.plantScale = Number.isFinite(s) ? Math.min(1.2, Math.max(0.6, s)) : 1;
  const ps = Number(data.settings.panelScale);
  data.settings.panelScale = Number.isFinite(ps) ? Math.min(1.45, Math.max(0.85, ps)) : 1;
  data.chat = { ...emptyChat(), ...(data.chat ?? {}) };
  if (data.chat.messages.length > 60) data.chat.messages = data.chat.messages.slice(-60);
  if (data.chat.facts.length > 40) data.chat.facts = data.chat.facts.slice(-40);
  if (!data.wellness || data.wellness.date !== today()) {
    data.wellness = { ...emptyWellness(), bedtimeDate: data.wellness?.bedtimeDate ?? null };
  }
  // Migration: fold old separate reminders into the unified task list.
  if (data.reminders.length > 0) {
    for (const r of data.reminders) {
      data.todos.push({
        id: r.id,
        text: r.text,
        done: false,
        createdAt: r.createdAt,
        due: r.due,
        recurring: r.recurring,
        firedAt: r.firedAt,
      });
    }
    data.reminders = [];
    saveData(data);
  }
  return data;
}

export function saveData(data: AppData) {
  window.companion.dataSave(data);
}

// Growth thresholds — generous: an ordinary day should reach bloom.
export function sproutStageFor(points: number): "bud" | "leaf" | "leaves" | "bloom" {
  if (points >= 5) return "bloom";
  if (points >= 3) return "leaves";
  if (points >= 1) return "leaf";
  return "bud";
}
