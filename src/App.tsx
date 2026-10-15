import { useEffect, useRef, useState } from "react";
import Blob from "./character/Blob";
import DebugMenu from "./DebugMenu";
import RadialMenu from "./ui/RadialMenu";
import TaskPanel from "./ui/TaskPanel";
import ChatPanel from "./ui/ChatPanel";
import ReminderBubble, { FiredReminder } from "./ui/ReminderBubble";
import NudgeBubble from "./ui/NudgeBubble";
import QuickNav from "./ui/QuickNav";
import Showcase from "./ui/Showcase";
import GrowthTestBar from "./ui/GrowthTestBar";
import SettingsPanel from "./ui/SettingsPanel";
import PanelResizeHandles from "./ui/PanelResizeHandles";
import { GrowthIcon } from "@/components/panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePanelTheme } from "./usePanelTheme";
import { formatDue, parseWhen } from "./reminders";
import { useCharacter } from "./character/useCharacter";
import { AppData, emptyData, loadData, saveData, today } from "./store";
import {
  GROWTH_LABEL,
  GROWTH_MAX_POINTS,
  GROWTH_TASK_BONUS_POINTS,
  GROWTH_WELLNESS_POINTS,
  ensureWeek,
  growthStageFor,
  type GrowthStage,
} from "./growth";
import { buildSystem, buildMessages, extractOutputs, jokeKey, pickFallbackJoke } from "./brain";
import { chirp, setSoundsEnabled, startDangle, stopDangle } from "./sounds";
import { isOpaqueCharacterAt, isUiHitAt } from "./clickThrough";
import { SPRITES } from "./generated/sprites";
import type { CharacterState } from "./character/types";

// Which stage→stage clap-and-grow transition clips are actually processed.
const TRANSITION_CLIPS = new Set<CharacterState>(
  (["grow1to2", "grow2to3", "grow3to4", "grow4to5", "grow5to6"] as CharacterState[]).filter(
    (k) => (SPRITES as Record<string, unknown>)[k],
  ),
);

declare global {
  interface Window {
    companion: {
      setClickThrough: (ignore: boolean) => void;
      cursorClientPos: () => Promise<{ x: number; y: number } | null>;
      dragStart: () => void;
      dragEnd: () => void;
      hide: () => void;
      quit: () => void;
      dataLoad: () => Promise<unknown>;
      dataSave: (data: unknown) => Promise<unknown> | void;
      layoutInfo: () => Promise<unknown>;
      setWindowSize: (size: { width: number; height: number }) => Promise<unknown>;
      ensureMic: () => Promise<unknown>;
      screenAccess: (opts?: { prompt?: boolean }) => Promise<string>;
      backdropLuminance: (area: { top: number; bottom: number }) => Promise<number | null>;
      idleSeconds: () => Promise<unknown>;
      transcribe: (audioBuffer: ArrayBuffer) => Promise<unknown>;
      brainStatus: () => Promise<unknown>;
      brainConnect: (key: string) => Promise<unknown>;
      chatSend: (payload: unknown) => Promise<unknown>;
      brainOnce: (payload: unknown) => Promise<unknown>;
      onChatEvent: (channel: string, handler: (data: unknown) => void) => () => void;
      openLink: (url: string) => void;
      setCallAutohide: (on: boolean) => void;
      getLoginItem: () => Promise<unknown>;
      setLoginItem: (on: boolean) => Promise<unknown>;
      brainDisconnect: () => Promise<unknown>;
      dataReset: () => Promise<unknown>;
      calendarStatus: () => Promise<{ hasClient: boolean; connected: boolean }>;
      calendarSaveClient: (creds: { clientId: string; clientSecret: string }) => Promise<{ ok: boolean; error?: string }>;
      calendarConnect: () => Promise<{ ok: boolean; error?: string }>;
      calendarDisconnect: () => Promise<{ ok: boolean }>;
      onCalendarMeeting: (
        handler: (data: { id: string; title: string; minutesUntil: number }) => void,
      ) => () => void;
    };
  }
}

/** Mark interactive UI so click-through sync can see it. Electron can only
 *  ignore the whole window — never leave ignore=false over empty pixels. */
const hitProps = { "data-hit": "1" } as const;

type Clip = { clipLeft: number; clipRight: number; clipTop: number; clipBottom: number };
const EMPTY_CLIP: Clip = { clipLeft: 0, clipRight: 0, clipTop: 0, clipBottom: 0 };

function normalizeClip(raw: Partial<Clip> | null | undefined): Clip {
  return {
    clipLeft: Math.max(0, Number(raw?.clipLeft) || 0),
    clipRight: Math.max(0, Number(raw?.clipRight) || 0),
    clipTop: Math.max(0, Number(raw?.clipTop) || 0),
    clipBottom: Math.max(0, Number(raw?.clipBottom) || 0),
  };
}

export default function App() {
  const { state, set } = useCharacter();
  const [data, setData] = useState<AppData>(emptyData());
  const [open, setOpen] = useState<"none" | "menu" | "tasks" | "chat" | "settings">("none");
  const [clip, setClip] = useState<Clip>(EMPTY_CLIP);
  const [firedQueue, setFiredQueue] = useState<FiredReminder[]>([]);
  const [toast, setToast] = useState<{ text: string; stage?: GrowthStage } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [showcase, setShowcase] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Live panel scale while edge-dragging (committed to settings on mouseup).
  const [livePanelScale, setLivePanelScale] = useState<number | null>(null);
  const mouseDownAt = useRef<{ x: number; y: number } | null>(null);

  // Scribbling: pen moves while the user types (short debounce) or records.
  const [typePulse, setTypePulse] = useState(false);
  const [recording, setRecording] = useState(false);
  const pulseTimer = useRef<number | null>(null);
  const noteActivity = () => {
    setTypePulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setTypePulse(false), 1500);
  };
  const scribbling = typePulse || recording;

  const refreshClip = async () => {
    try {
      const raw = await window.companion.layoutInfo();
      setClip(normalizeClip(raw as Partial<Clip>));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setSoundsEnabled(d.settings.soundsOn);
      setTimeout(() => chirp("hello"), 600);
    });
    window.companion?.setClickThrough(true);
    const stop = () => {
      setDragging((was) => {
        if (was) {
          window.companion?.dragEnd();
          stopDangle();
          set("idle");
        }
        return false;
      });
      mouseDownAt.current = null;
    };
    document.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);
    return () => {
      document.removeEventListener("mouseup", stop);
      window.removeEventListener("blur", stop);
    };
  }, [set]);

  // Click-through: Electron can only ignore the WHOLE window. Keep ignore on
  // unless the cursor is over opaque character pixels or marked UI [data-hit].
  // Poll screen cursor too — transparent always-on-top windows often miss mouseleave.
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;
  useEffect(() => {
    let ignoring = true;
    const apply = (ignore: boolean) => {
      if (ignore === ignoring) return;
      ignoring = ignore;
      window.companion?.setClickThrough(ignore);
    };
    const syncFromPoint = (x: number, y: number) => {
      if (draggingRef.current) {
        apply(false);
        return;
      }
      const hit = isUiHitAt(x, y) || isOpaqueCharacterAt(x, y);
      apply(!hit);
    };
    const onMove = (e: PointerEvent) => syncFromPoint(e.clientX, e.clientY);
    const release = () => {
      if (!draggingRef.current) apply(true);
    };
    const poll = window.setInterval(() => {
      void (async () => {
        if (!window.companion?.cursorClientPos) return;
        if (draggingRef.current) {
          apply(false);
          return;
        }
        const pos = await window.companion.cursorClientPos();
        if (!pos) {
          apply(true);
          return;
        }
        syncFromPoint(pos.x, pos.y);
      })();
    }, 50);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", release);
    window.addEventListener("blur", release);
    apply(true);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", release);
      window.removeEventListener("blur", release);
      apply(true);
    };
  }, []);

  const update = (fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(structuredClone(prev));
      saveData(next);
      return next;
    });
  };

  /** Wellness = main growth; timed tasks = small bonus. Caps at full plant. */
  const growSprout = (kind: "wellness" | "taskBonus" = "wellness") => {
    const add = kind === "wellness" ? GROWTH_WELLNESS_POINTS : GROWTH_TASK_BONUS_POINTS;
    let leveledUp = false;
    let nextStage: GrowthStage = 1;
    let fromStage: GrowthStage = 1;
    update((d) => {
      if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
      d.week = ensureWeek(d.week);
      const before = growthStageFor(d.sprout.points);
      fromStage = before;
      d.sprout.points = Math.min(GROWTH_MAX_POINTS, d.sprout.points + add);
      nextStage = growthStageFor(d.sprout.points);
      leveledUp = nextStage > before;
      if (kind === "wellness") d.week.wellness += 1;
      else d.week.taskBonus += 1;
      if (nextStage > d.week.stagePeak) d.week.stagePeak = nextStage;
      return d;
    });
    if (leveledUp) {
      // Single-step level-up plays its clap→grow transition clip if we have it;
      // otherwise fall back to the generic celebration.
      const transKey = `grow${fromStage}to${nextStage}` as CharacterState;
      set(TRANSITION_CLIPS.has(transKey) ? transKey : "celebrating");
      chirp("celebrate");
      showToast(GROWTH_LABEL[nextStage], nextStage);
    }
    return { leveledUp, stage: nextStage };
  };

  // --- Task engine: timed tasks ring; checks every 8s; catches up on wake ---
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
    setSoundsEnabled(data.settings.soundsOn);
    window.companion.setCallAutohide?.(data.settings.autoHideOnCalls);
  }, [data]);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // --- Wellness engine: notices long stretches of work, bedtime, water ---
  type NudgeKind = "stretch" | "water" | "bedtime";
  const [nudge, setNudge] = useState<NudgeKind | null>(null);
  const nudgeRef = useRef<NudgeKind | null>(null);
  useEffect(() => {
    nudgeRef.current = nudge;
  }, [nudge]);
  const activeMsRef = useRef(0);
  const waterMsRef = useRef(0);

  const markProactive = () => {
    update((d) => {
      if (d.wellness.date !== today())
        d.wellness = { date: today(), proactive: 0, lastNudgeAt: null, bedtimeDate: d.wellness.bedtimeDate };
      d.wellness.proactive += 1;
      d.wellness.lastNudgeAt = new Date().toISOString();
      return d;
    });
  };

  const triggerNudge = (kind: NudgeKind) => {
    chirp(kind === "bedtime" ? "sleepy" : "pop");
    if (kind === "bedtime") {
      set("sleeping");
      update((d) => {
        d.wellness.bedtimeDate = today();
        return d;
      });
    } else {
      set(kind === "water" ? "watering" : "stretching");
    }
    setNudge(kind);
    markProactive();
    activeMsRef.current = 0;
    if (kind === "water") waterMsRef.current = 0;
  };

  useEffect(() => {
    const TICK = 30_000;
    const check = async () => {
      try {
        // Suppressed while hidden (focus mode), mid-interaction, or already nudging.
        if (document.visibilityState === "hidden") return;
        if (nudgeRef.current || openRef.current !== "none") return;
        if (stateRef.current === "sleeping" || stateRef.current === "dragged") return;

        const idle = (await window.companion.idleSeconds()) as number;
        if (idle < 60) {
          activeMsRef.current += TICK;
          waterMsRef.current += TICK;
        } else if (idle > 300) {
          activeMsRef.current = 0; // a real break resets the clock
        }

        const d = dataRef.current;
        const w = d.wellness.date === today() ? d.wellness : { ...d.wellness, proactive: 0, lastNudgeAt: null };
        const gapOk = !w.lastNudgeAt || Date.now() - new Date(w.lastNudgeAt).getTime() > 15 * 60_000;
        const capOk = w.proactive < 4;

        // Bedtime care: once per evening, from the configured time onward.
        if (d.settings.bedtime && w.bedtimeDate !== today()) {
          const [hh, mm] = d.settings.bedtime.split(":").map(Number);
          const nowD = new Date();
          if (nowD.getHours() > hh || (nowD.getHours() === hh && nowD.getMinutes() >= mm)) {
            if (capOk) triggerNudge("bedtime");
            return;
          }
        }

        if (!capOk || !gapOk) return;

        if (activeMsRef.current >= d.settings.breakMins * 60_000) {
          triggerNudge("stretch");
          return;
        }
        if (d.settings.waterNudge && waterMsRef.current >= 2 * 60 * 60_000) {
          triggerNudge("water");
        }
      } catch {}
    };
    const id = window.setInterval(check, TICK);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const NUDGE_TEXT: Record<NudgeKind, string> = {
    stretch: "you've been at it a while. stretch with me?",
    water: "little water break?",
    bedtime: "I'm sleepy… don't stay up too late, okay?",
  };

  // --- Chat brain -----------------------------------------------------------
  const [brainConnected, setBrainConnected] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const streamRef = useRef("");

  // While chat is open, stay on coffee sip — timed poses (celebrate/write)
  // auto-return to idle; nudge back so the yellow blob never shows.
  useEffect(() => {
    if (open === "chat" && !chatBusy && (state === "idle" || state === "thinking" || state === "listening")) {
      set("coffee");
    }
  }, [open, chatBusy, state, set]);

  useEffect(() => {
    (window.companion.brainStatus() as Promise<{ connected: boolean }>).then((s) =>
      setBrainConnected(!!s?.connected),
    );
    const offChunk = window.companion.onChatEvent("chat-chunk", (d) => {
      const { delta } = d as { delta: string };
      streamRef.current += delta;
      setStreamText(streamRef.current);
    });
    const offDone = window.companion.onChatEvent("chat-done", (d) => {
      const { text, sources } = d as { text: string; sources?: { title: string; url: string }[] };
      const { clean, facts, tasks, completes } = extractOutputs(text);
      let completedAny = false;
      let timedBonusFromChat = false;
      update((x) => {
        x.chat.messages.push({ role: "assistant", text: clean || "…", at: new Date().toISOString(), sources: sources && sources.length ? sources.slice(0, 8) : undefined });
        for (const f of facts) if (!x.chat.facts.includes(f)) x.chat.facts.push(f);
        if (x.chat.facts.length > 40) x.chat.facts = x.chat.facts.slice(-40);
        if (x.chat.messages.length > 60) x.chat.messages = x.chat.messages.slice(-60);
        // Tasks Blob created in conversation
        for (const t of tasks) {
          let dueIso: string | null = null;
          if (t.due) {
            const d1 = new Date(t.due);
            if (!isNaN(d1.getTime())) dueIso = d1.toISOString();
            else {
              const d2 = parseWhen(t.due);
              if (d2) dueIso = d2.toISOString();
            }
          }
          x.todos.unshift({
            id: crypto.randomUUID(),
            text: t.text,
            done: false,
            createdAt: new Date().toISOString(),
            due: dueIso,
            recurring: t.recurring,
            firedAt: null,
          });
        }
        // Tasks Blob marked done from conversation
        for (const target of completes) {
          const needle = target.toLowerCase();
          const match = x.todos.find(
            (td) => !td.done && (td.text.toLowerCase().includes(needle) || needle.includes(td.text.toLowerCase())),
          );
          if (match) {
            match.done = true;
            match.completedAt = new Date().toISOString();
            completedAny = true;
            if (match.due) timedBonusFromChat = true;
          }
        }
        return x;
      });
      streamRef.current = "";
      setStreamText(null);
      setChatBusy(false);
      if (timedBonusFromChat) {
        const r = growSprout("taskBonus");
        if (!r.leveledUp) {
          set("celebrating");
          chirp("celebrate");
        }
      } else if (completedAny) {
        set("celebrating");
        chirp("celebrate");
      } else if (tasks.length > 0) {
        set("writing");
        chirp("pop");
      } else {
        set("coffee");
        chirp("msg");
      }
    });
    const offErr = window.companion.onChatEvent("chat-error", (d) => {
      const { error } = d as { error: string };
      update((x) => {
        const friendly = error.includes("credit balance")
          ? "my thinking credits ran out 😅 top me up at platform.claude.com → Plans & Billing and I'll be right back!"
          : error.includes("401")
            ? "I'm having trouble thinking right now 😅 (is my key okay?)"
            : "I'm having trouble thinking right now 😅 (are we online?)";
        x.chat.messages.push({
          role: "assistant",
          text: friendly,
          at: new Date().toISOString(),
        });
        return x;
      });
      streamRef.current = "";
      setStreamText(null);
      setChatBusy(false);
      set("coffee");
    });
    return () => {
      offChunk();
      offDone();
      offErr();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendChat = (text: string) => {
    const userMsg = { role: "user" as const, text, at: new Date().toISOString() };
    const draft = structuredClone(dataRef.current);
    draft.chat.messages.push(userMsg);
    update((x) => {
      x.chat.messages.push(userMsg);
      return x;
    });
    setChatBusy(true);
    streamRef.current = "";
    setStreamText("");
    set("coffee");
    void window.companion.chatSend({
      id: crypto.randomUUID(),
      system: buildSystem(draft),
      messages: buildMessages(draft),
    });
  };

  const connectBrain = async (key: string) => {
    const res = (await window.companion.brainConnect(key)) as { ok: boolean };
    if (res?.ok) {
      setBrainConnected(true);
      showToast("Brain connected");
    } else {
      showToast("Hmm, couldn't save the key");
    }
  };

  // --- Jokes: every ~3 hours, "what do you call…?" ---------------------------
  const [joke, setJoke] = useState<{ setup: string; punchline: string; revealed: boolean } | null>(null);
  const jokeRef = useRef(joke);
  useEffect(() => {
    jokeRef.current = joke;
  }, [joke]);

  // Google Calendar meeting ping — RAM only; never saved / never sent to Claude.
  const [meeting, setMeeting] = useState<{ title: string; minutesUntil: number } | null>(null);
  useEffect(() => {
    if (!window.companion?.onCalendarMeeting) return;
    return window.companion.onCalendarMeeting((m) => {
      if (!dataRef.current.settings.calendarReminders) return;
      if (document.visibilityState === "hidden") return;
      if (stateRef.current === "sleeping" || stateRef.current === "dragged") return;
      setMeeting({ title: m.title, minutesUntil: m.minutesUntil });
      set("meeting");
      chirp("bell");
    });
  }, []);

  const tellJoke = async () => {
    const recent = dataRef.current.chat.jokeRecent ?? [];
    let j = pickFallbackJoke(recent);
    try {
      const avoid =
        recent.length > 0
          ? `\nDo NOT reuse any of these recent setups (pick something different):\n- ${recent.slice(-15).join("\n- ")}`
          : "";
      const res = (await window.companion.brainOnce({
        system:
          'You write one original, silly, wholesome joke in the exact format: a question starting with "what do you call" and a short punchline. Vary topics — animals, food, plants, everyday life. Never repeat a joke from the avoid-list. Reply with ONLY JSON: {"setup":"what do you call …?","punchline":"…"}',
        prompt: `one fresh joke please. make it giggle-worthy and kid-friendly.${avoid}`,
        maxTokens: 120,
      })) as { ok: boolean; text?: string };
      if (res?.ok && res.text) {
        const parsed = JSON.parse(res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1));
        if (parsed.setup && parsed.punchline) {
          const key = jokeKey(parsed.setup);
          // If the model echoed a recent one, keep the local fresh pick instead.
          if (!recent.map(jokeKey).includes(key)) j = parsed;
        }
      }
    } catch {}
    setJoke({ setup: j.setup, punchline: j.punchline, revealed: false });
    set("waving");
    chirp("pop");
    update((d) => {
      d.chat.jokeLastAt = new Date().toISOString();
      const key = jokeKey(j.setup);
      const next = [...(d.chat.jokeRecent ?? []).filter((x) => jokeKey(x) !== key), key];
      d.chat.jokeRecent = next.slice(-40);
      return d;
    });
  };

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "hidden") return;
      if (jokeRef.current || nudgeRef.current || openRef.current !== "none") return;
      if (stateRef.current === "sleeping" || stateRef.current === "dragged") return;
      const freq = dataRef.current.settings.jokeEvery;
      if (freq === "off") return;
      const gapH = freq === "rare" ? 6 : 3;
      const last = dataRef.current.chat.jokeLastAt;
      if (!last || Date.now() - new Date(last).getTime() > gapH * 60 * 60_000) {
        void tellJoke();
      }
    };
    const id = window.setInterval(check, 10 * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const t of dataRef.current.todos) {
        if (!t.due || t.done || t.firedAt || new Date(t.due).getTime() > now) continue;
        const missed = now - new Date(t.due).getTime() > 2 * 60 * 1000;
        const fired: FiredReminder = {
          id: t.id,
          text: t.text,
          timeLabel: formatDue(new Date(t.due)),
          missed,
          recurring: t.recurring,
        };
        update((d) => {
          const x = d.todos.find((y) => y.id === t.id);
          if (!x) return d;
          if (x.recurring === "daily") {
            const next = new Date(x.due!);
            next.setDate(next.getDate() + 1);
            x.due = next.toISOString();
            x.firedAt = null;
          } else {
            x.firedAt = new Date().toISOString();
          }
          return d;
        });
        setFiredQueue((q) => (q.some((f) => f.id === fired.id) ? q : [...q, fired]));
        chirp("pop");
        try {
          new Notification("Your companion 🌱", { body: `⏰ ${t.text}` });
        } catch {}
        set("waving");
      }
    };
    const id = window.setInterval(check, 8000);
    const t = window.setTimeout(check, 1500);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTask = (text: string, due?: Date, recurring?: "daily") => {
    update((d) => {
      d.todos.unshift({
        id: crypto.randomUUID(),
        text,
        done: false,
        createdAt: new Date().toISOString(),
        due: due ? due.toISOString() : null,
        recurring,
        firedAt: null,
      });
      return d;
    });
    set(open === "tasks" ? "noting" : "writing");
  };

  const editTask = (id: string, text: string, due: Date | null) => {
    update((d) => {
      const x = d.todos.find((y) => y.id === id);
      if (x) {
        x.text = text;
        x.due = due ? due.toISOString() : null;
        x.firedAt = null; // re-arm if a time was set
      }
      return d;
    });
    set(open === "tasks" ? "noting" : "writing");
  };

  const toggleTask = (id: string) => {
    const t = data.todos.find((x) => x.id === id);
    if (!t) return;
    const completing = !t.done;
    update((d) => {
      const x = d.todos.find((y) => y.id === id)!;
      x.done = !x.done;
      x.completedAt = x.done ? new Date().toISOString() : undefined;
      return d;
    });
    if (completing) {
      // Timed tasks = small growth bonus; plain tasks just celebrate.
      if (t.due) {
        const r = growSprout("taskBonus");
        if (!r.leveledUp) {
          set("celebrating");
          chirp("celebrate");
        }
      } else {
        set("celebrating");
        chirp("celebrate");
      }
    }
  };

  const deleteTask = (id: string) => {
    update((d) => {
      d.todos = d.todos.filter((x) => x.id !== id);
      return d;
    });
  };

  const dismissFired = (id: string, done: boolean) => {
    const fired = firedQueue.find((f) => f.id === id);
    setFiredQueue((q) => q.filter((f) => f.id !== id));
    if (done) {
      update((d) => {
        const x = d.todos.find((y) => y.id === id);
        if (x && !fired?.recurring) {
          x.done = true;
          x.completedAt = new Date().toISOString();
        }
        return d;
      });
      const r = growSprout("taskBonus");
      if (!r.leveledUp) {
        set("celebrating");
        chirp("celebrate");
      }
    } else {
      update((d) => {
        const x = d.todos.find((y) => y.id === id);
        if (x) {
          x.due = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          x.firedAt = null;
        }
        return d;
      });
    }
  };

  const patchSettings = (patch: Partial<AppData["settings"]>) => {
    update((d) => {
      d.settings = { ...d.settings, ...patch };
      return d;
    });
  };

  const showToast = (msg: string, stage?: GrowthStage) => {
    setToast({ text: msg, stage });
    setTimeout(() => setToast(null), 2200);
  };

  const growthStage = growthStageFor(data.sprout.points);
  const week = ensureWeek(data.week);
  const panelOpen = open === "tasks" || open === "chat" || open === "settings";

  // Panel size when fully on-screen. Near a screen edge, shrink width
  // to the visible band so chat/tasks aren't clipped (plant stays put).
  // panelScale grows chat/tasks/settings; window expands upward to match.
  const BASE_W = 384;
  const BASE_H = 600;
  const BASE_PANEL_H = 310;
  const CHAR_H = 240;
  const uiPad = 6;
  const PLANT_GAP = 10; // space between panel bottom and plant top
  const STACK_GAP = 6; // space between QuickNav and panel
  const NAV_H = 40;
  const plantScale = data.settings.plantScale ?? 1;
  const savedPanelScale = Math.min(1.45, Math.max(0.85, data.settings.panelScale ?? 1));
  const panelScale = livePanelScale ?? savedPanelScale;
  const WIN_W = Math.round(BASE_W * (1 + (panelScale - 1) * 0.55));
  const PANEL_H = Math.round(BASE_PANEL_H * panelScale);
  const plantH = CHAR_H * plantScale;
  const WIN_H = Math.max(
    BASE_H,
    Math.ceil(plantH + PLANT_GAP + PANEL_H + STACK_GAP + NAV_H + 20),
  );
  const PANEL_W = WIN_W - uiPad * 2;
  const visL = clip.clipLeft + uiPad;
  const visR = WIN_W - clip.clipRight - uiPad;
  const availW = Math.max(0, visR - visL);
  const panelW = availW > 0 ? Math.min(PANEL_W, availW) : PANEL_W;
  let panelLeft = uiPad;
  if (panelLeft < visL) panelLeft = visL;
  if (panelLeft + panelW > visR) panelLeft = Math.max(visL, visR - panelW);
  // Distance from window bottom → keeps stack glued to the plant.
  const stackBottom = plantH + PLANT_GAP;

  // Panels: follow macOS light/dark, or (opt-in) match the app behind us.
  usePanelTheme(
    !!data.settings.matchBackdrop,
    panelOpen || open === "menu" || showcase || firedQueue.length > 0 || !!nudge || !!joke || !!meeting,
    {
      top: Math.max(0, WIN_H - stackBottom - PANEL_H - STACK_GAP - NAV_H),
      bottom: Math.max(0, WIN_H - stackBottom),
    },
  );

  // Keep Electron window sized for the chosen panel scale (grow up from plant).
  useEffect(() => {
    void (async () => {
      try {
        const raw = await window.companion.setWindowSize({ width: WIN_W, height: WIN_H });
        setClip(normalizeClip(raw as Partial<Clip>));
      } catch {
        /* ignore */
      }
    })();
  }, [WIN_W, WIN_H]);

  // Refresh edge clips when UI opens — never nudge the window/plant.
  useEffect(() => {
    if (panelOpen || open === "menu" || showcase) void refreshClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, open, showcase]);

  return (
    <TooltipProvider delayDuration={350}>
    <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "none" }}>
      {panelOpen && (
        <div
          style={{
            position: "absolute",
            left: panelLeft,
            width: panelW,
            bottom: stackBottom,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: STACK_GAP,
            pointerEvents: "none",
          }}
        >
          <QuickNav
            items={[
              { icon: "chat", label: "chat", active: open === "chat", onClick: () => { setOpen("chat"); if (!chatBusy) set("coffee"); } },
              { icon: "tasks", label: "tasks", active: open === "tasks", onClick: () => { setOpen("tasks"); set("noting"); } },
              { icon: "settings", label: "settings", active: open === "settings", onClick: () => { setOpen("settings"); set("idle"); } },
              { icon: "tuck", label: "nap", onClick: () => { setOpen("none"); window.companion?.hide(); } },
            ]}
          />
          <div
            {...hitProps}
            style={{
              position: "relative",
              width: "100%",
              height: PANEL_H,
              pointerEvents: "auto",
              flexShrink: 0,
            }}
          >
            <PanelResizeHandles
              scale={panelScale}
              onScaleLive={setLivePanelScale}
              onScaleCommit={(v) => {
                setLivePanelScale(null);
                patchSettings({ panelScale: v });
              }}
            />
            {open === "tasks" && (
              <TaskPanel
                todos={data.todos}
                growthStage={growthStage}
                onAdd={addTask}
                onActivity={noteActivity}
                onMicPhase={setRecording}
                onEdit={editTask}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onClose={() => {
                  setOpen("none");
                  set("idle");
                }}
              />
            )}
            {open === "settings" && (
              <SettingsPanel
                settings={data.settings}
                facts={data.chat.facts}
                week={week}
                growthStage={growthStage}
                onPatch={patchSettings}
                onDeleteFact={(f) =>
                  update((d) => {
                    d.chat.facts = d.chat.facts.filter((x) => x !== f);
                    return d;
                  })
                }
                onClearChat={async () => {
                  const next = structuredClone(dataRef.current);
                  next.chat.messages = [];
                  next.chat.summary = "";
                  dataRef.current = next;
                  setData(next);
                  setStreamText(null);
                  await window.companion.dataSave(next);
                }}
                onChangeKey={async () => {
                  await window.companion.brainDisconnect();
                  setBrainConnected(false);
                  setOpen("chat");
                  set("coffee");
                }}
                onDeleteAll={() => {
                  void window.companion.dataReset();
                }}
                onClose={() => {
                  setOpen("none");
                  set("idle");
                }}
              />
            )}
            {open === "chat" && (
              <ChatPanel
                messages={data.chat.messages}
                streamText={streamText}
                busy={chatBusy}
                connected={brainConnected}
                companionName={data.settings.companionName}
                userName={data.settings.userName}
                onConnectKey={connectBrain}
                onSend={sendChat}
                onClose={() => {
                  setOpen("none");
                  if (!chatBusy) set("idle");
                }}
                onBlobState={() => {
                  // Stay in coffee sip while chat is open (ignore focus idle/listening).
                  if (!chatBusy) set("coffee");
                }}
              />
            )}
          </div>
        </div>
      )}

      {showcase && (
        <div
          style={{
            position: "absolute",
            left: panelLeft,
            width: panelW,
            bottom: stackBottom,
            zIndex: 30,
          }}
        >
          <Showcase
            onPlay={(s) => {
              if (!chatBusy) set(s);
              if (s === "meeting") chirp("bell");
            }}
            onClose={() => {
              setShowcase(false);
              set("idle");
            }}
          />
        </div>
      )}

      {open === "menu" && (
        <RadialMenu
          clipLeft={clip.clipLeft}
          clipRight={clip.clipRight}
          clipTop={clip.clipTop}
          clipBottom={clip.clipBottom}
          plantScale={data.settings.plantScale ?? 1}
          onDismiss={() => {
            setOpen("none");
            set("idle");
            chirp("boop");
          }}
          onSecret={() => {
            setOpen("none");
            setShowcase(true);
            chirp("giggle");
          }}
          items={[
            { icon: "chat", label: "chat", onClick: () => { setOpen("chat"); set("coffee"); } },
            {
              icon: "tasks",
              label: "tasks",
              onClick: () => {
                setOpen("tasks");
                set("noting"); // notepad out, spectacles on, pen ready
              },
            },
            { icon: "settings", label: "settings", onClick: () => setOpen("settings") },
            {
              icon: "tuck",
              label: "nap",
              onClick: () => {
                setOpen("none");
                window.companion?.hide();
              },
            },
          ]}
        />
      )}

      {firedQueue.length > 0 && (
        <ReminderBubble
          fired={firedQueue[0]}
          onDone={() => dismissFired(firedQueue[0].id, true)}
          onSnooze={() => dismissFired(firedQueue[0].id, false)}
        />
      )}

      {meeting && firedQueue.length === 0 && (
        <NudgeBubble
          text={
            meeting.minutesUntil <= 0
              ? `"${meeting.title}" is starting now`
              : `"${meeting.title}" in ${meeting.minutesUntil} min`
          }
          actions={[
            {
              label: "Got it",
              primary: true,
              onClick: () => setMeeting(null),
            },
          ]}
        />
      )}

      {joke && firedQueue.length === 0 && !nudge && !meeting && (
        <NudgeBubble
          text={joke.revealed ? joke.punchline : joke.setup}
          actions={
            joke.revealed
              ? [
                  {
                    label: "Haha",
                    primary: true,
                    onClick: () => {
                      setJoke(null);
                      set("idle");
                    },
                  },
                ]
              : [
                  {
                    label: "What?",
                    primary: true,
                    onClick: () => {
                      setJoke({ ...joke, revealed: true });
                      set("celebrating");
                      chirp("giggle");
                    },
                  },
                  {
                    label: "Not now",
                    onClick: () => {
                      setJoke(null);
                      set("idle");
                    },
                  },
                ]
          }
        />
      )}

      {nudge && firedQueue.length === 0 && !meeting && (
        <NudgeBubble
          text={NUDGE_TEXT[nudge]}
          actions={
            nudge === "bedtime"
              ? [{ label: "Good night", primary: true, onClick: () => setNudge(null) }]
              : [
                  {
                    label: "Did it",
                    primary: true,
                    onClick: () => {
                      setNudge(null);
                      const r = growSprout("wellness");
                      if (!r.leveledUp) {
                        set("celebrating");
                        chirp("celebrate");
                      }
                    },
                  },
                  {
                    label: "Not now",
                    onClick: () => {
                      setNudge(null);
                      set("idle");
                    },
                  },
                ]
          }
        />
      )}

      {toast && (
        <div
          key={toast.text}
          data-slot="toast"
          role="status"
          className="absolute bottom-[216px] left-1/2 z-30 inline-flex h-8 -translate-x-1/2 animate-toast-in items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] font-medium whitespace-nowrap text-background shadow-float"
        >
          {toast.stage && <GrowthIcon stage={toast.stage} className="size-4 text-success-soft" />}
          {toast.text}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 204,
          height: 240,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${data.settings.plantScale ?? 1})`,
            transformOrigin: "bottom center",
            transition: "transform 0.2s ease",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <Blob state={state} growthStage={growthStage} scribbling={scribbling} />
        </div>
        {/* Hit layer: receives drag/click only while click-through is off
            (i.e. cursor is over opaque plant pixels — see clickThrough sync). */}
        <div
          data-char-hit="1"
          onMouseDown={(e) => {
            if (e.button === 0) mouseDownAt.current = { x: e.screenX, y: e.screenY };
          }}
          onMouseMove={(e) => {
            if (mouseDownAt.current && !dragging) {
              const dx = e.screenX - mouseDownAt.current.x;
              const dy = e.screenY - mouseDownAt.current.y;
              if (Math.hypot(dx, dy) > 5) {
                window.companion?.dragStart();
                setDragging(true);
                set("dragged");
                setOpen("none");
                startDangle();
              }
            }
          }}
          onMouseUp={async () => {
            if (!dragging && mouseDownAt.current) {
              if (state === "sleeping") {
                set("waking");
                setNudge(null);
                mouseDownAt.current = null;
                return;
              }
              if (open === "none") {
                await refreshClip();
                setOpen("menu");
                set("idlehop");
                chirp("boop");
              } else {
                setOpen("none");
                set("idle");
              }
            }
            mouseDownAt.current = null;
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setDebugOpen((o) => !o);
          }}
          title="Click me for the menu · drag me anywhere"
          style={{
            position: "absolute",
            inset: 0,
            cursor: dragging ? "grabbing" : "grab",
            pointerEvents: "auto",
          }}
        />
      </div>

      {/* Always-on growth test strip (beside plant) — idle stages + level-up clips */}
      <GrowthTestBar
        growthStage={growthStage}
        visible={data.settings.growthTestVisible}
        onVisibleChange={(v) =>
          update((d) => {
            d.settings.growthTestVisible = v;
            return d;
          })
        }
        onIdleStage={(s) =>
          update((d) => {
            if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
            d.sprout.points = s === 1 ? 0 : s === 2 ? 2 : s === 3 ? 4 : s === 4 ? 6 : s === 5 ? 8 : 10;
            return d;
          })
        }
        onPlayTransition={(from, to) => {
          const key = `grow${from}to${to}` as CharacterState;
          if (!TRANSITION_CLIPS.has(key)) return;
          // Land on destination stage so idle after the clip matches.
          update((d) => {
            if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
            d.sprout.points = to === 1 ? 0 : to === 2 ? 2 : to === 3 ? 4 : to === 4 ? 6 : to === 5 ? 8 : 10;
            return d;
          });
          setOpen("none");
          set(key);
          chirp("celebrate");
        }}
        onPlayWatering={() => {
          setOpen("none");
          set("watering");
        }}
      />

      {debugOpen && (
        <div data-hit="1" style={{ position: "absolute", left: 8, top: 8, pointerEvents: "auto", zIndex: 50 }}>
          <DebugMenu
            current={state}
            growthStage={growthStage}
            onState={set}
            onTestNudge={(k) => triggerNudge(k)}
            onTestJoke={() => void tellJoke()}
            soundsOn={data.settings.soundsOn}
            onToggleSounds={() => update((d) => { d.settings.soundsOn = !d.settings.soundsOn; return d; })}
            onGrowthStage={(s) =>
              update((d) => {
                if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
                // Jump to the minimum points for that stage (preview only).
                d.sprout.points = s === 1 ? 0 : s === 2 ? 2 : s === 3 ? 4 : s === 4 ? 6 : s === 5 ? 8 : 10;
                return d;
              })
            }
            onClose={() => setDebugOpen(false)}
          />
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
