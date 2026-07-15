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

export interface AppData {
  todos: Todo[];
  reminders: Reminder[];
  // Sprout progress for TODAY. Only ever grows; resets fresh each morning.
  sprout: { date: string; points: number };
}

export const emptyData = (): AppData => ({
  todos: [],
  reminders: [],
  sprout: { date: today(), points: 0 },
});

export function today(): string {
  const d = new Date();
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
