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
import SettingsPanel from "./ui/SettingsPanel";
import PanelResizeHandles from "./ui/PanelResizeHandles";
import { formatDue, parseWhen } from "./reminders";
import { useCharacter } from "./character/useCharacter";
import { AppData, emptyData, loadData, saveData, sproutStageFor, today } from "./store";
import { buildSystem, buildMessages, extractOutputs, FALLBACK_JOKES } from "./brain";
import { chirp, setSoundsEnabled, startDangle, stopDangle } from "./sounds";
import type { CharacterState } from "./character/types";

declare global {
  interface Window {
    companion: {
      setClickThrough: (ignore: boolean) => void;
      dragStart: () => void;
      dragEnd: () => void;
      hide: () => void;
      quit: () => void;
      dataLoad: () => Promise<unknown>;
      dataSave: (data: unknown) => Promise<unknown> | void;
      layoutInfo: () => Promise<unknown>;
      setWindowSize: (size: { width: number; height: number }) => Promise<unknown>;
      ensureMic: () => Promise<unknown>;
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
    };
  }
}

const hoverable = {
  onMouseEnter: () => window.companion?.setClickThrough(false),
  onMouseLeave: () => window.companion?.setClickThrough(true),
};

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
  const [toast, setToast] = useState<string | null>(null);
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

  const update = (fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(structuredClone(prev));
      saveData(next);
      return next;
    });
  };

  const growSprout = () => {
    update((d) => {
      if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
      d.sprout.points += 1;
      return d;
    });
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

  // Spontaneous life (PRD: "subtle randomized idle variations"):
  // every 10 minutes the resting default rotates through living poses,
  // and while on calm idle he still hops once in a while (avg ~40s).
  const REST_POSES: CharacterState[] = [
    "idle",
    "lying",
    "hammock",
    "meditate",
    "picnic",
    "groove",
    "hula",
  ];
  const restIdx = useRef(0);
  const nextRestAt = useRef(Date.now() + 10 * 60_000);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (openRef.current !== "none") return;
      const s = stateRef.current;
      const resting = REST_POSES.includes(s) || s === "idlehop";
      if (!resting) return;
      if (Date.now() >= nextRestAt.current) {
        restIdx.current = (restIdx.current + 1) % REST_POSES.length;
        set(REST_POSES[restIdx.current]);
        nextRestAt.current = Date.now() + 10 * 60_000;
      } else if (s === "idle" && Math.random() < 0.2) {
        set("idlehop");
      }
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    stretch: "you've been at it a while — stretch with me? 🧘",
    water: "little water break? 💧",
    bedtime: "I'm sleepy… don't stay up too late, okay? 💤",
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
            if (x.sprout.date !== today()) x.sprout = { date: today(), points: 0 };
            x.sprout.points += 1;
          }
        }
        return x;
      });
      streamRef.current = "";
      setStreamText(null);
      setChatBusy(false);
      if (completedAny) {
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
      showToast("brain connected! 🧠✨");
    } else {
      showToast("hmm, couldn't save the key");
    }
  };

  // --- Jokes: every ~3 hours, "what do you call…?" ---------------------------
  const [joke, setJoke] = useState<{ setup: string; punchline: string; revealed: boolean } | null>(null);
  const jokeRef = useRef(joke);
  useEffect(() => {
    jokeRef.current = joke;
  }, [joke]);

  const tellJoke = async () => {
    let j = FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)];
    try {
      const res = (await window.companion.brainOnce({
        system:
          'You write one original, silly, wholesome joke in the exact format: a question starting with "what do you call" and a short punchline. Reply with ONLY JSON: {"setup":"what do you call …?","punchline":"…"}',
        prompt: "one fresh joke please. make it giggle-worthy and kid-friendly.",
        maxTokens: 120,
      })) as { ok: boolean; text?: string };
      if (res?.ok && res.text) {
        const parsed = JSON.parse(res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1));
        if (parsed.setup && parsed.punchline) j = parsed;
      }
    } catch {}
    setJoke({ setup: j.setup, punchline: j.punchline, revealed: false });
    set("waving");
    chirp("pop");
    update((d) => {
      d.chat.jokeLastAt = new Date().toISOString();
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
      set("celebrating");
      chirp("celebrate");
      growSprout();
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
      set("celebrating");
      chirp("celebrate");
      growSprout();
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const sproutStage = sproutStageFor(data.sprout.points);
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
            {...hoverable}
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
                sproutStage={sproutStage}
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

      {joke && firedQueue.length === 0 && !nudge && (
        <NudgeBubble
          text={joke.revealed ? joke.punchline : joke.setup}
          actions={
            joke.revealed
              ? [
                  {
                    label: "hehe ✓",
                    primary: true,
                    onClick: () => {
                      setJoke(null);
                      set("idle");
                    },
                  },
                ]
              : [
                  {
                    label: "what? 🤔",
                    primary: true,
                    onClick: () => {
                      setJoke({ ...joke, revealed: true });
                      set("celebrating");
                      chirp("giggle");
                    },
                  },
                  {
                    label: "not now",
                    onClick: () => {
                      setJoke(null);
                      set("idle");
                    },
                  },
                ]
          }
        />
      )}

      {nudge && firedQueue.length === 0 && (
        <NudgeBubble
          text={NUDGE_TEXT[nudge]}
          actions={
            nudge === "bedtime"
              ? [{ label: "good night 💤", primary: true, onClick: () => setNudge(null) }]
              : [
                  {
                    label: "did it! 🌱",
                    primary: true,
                    onClick: () => {
                      setNudge(null);
                      set("celebrating");
                      chirp("celebrate");
                      growSprout();
                    },
                  },
                  {
                    label: "not now",
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
          style={{
            position: "absolute",
            bottom: 215,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(90, 74, 58, 0.92)",
            color: "#fff8ec",
            fontSize: 11.5,
            fontFamily: "system-ui, sans-serif",
            padding: "6px 12px",
            borderRadius: 10,
            whiteSpace: "nowrap",
            zIndex: 30,
          }}
        >
          {toast}
        </div>
      )}

      <div
        onMouseEnter={() => window.companion?.setClickThrough(false)}
        onMouseLeave={() => {
          if (!dragging && open === "none" && !debugOpen) window.companion?.setClickThrough(true);
        }}
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
              // First click on a sleeping blob just wakes it up.
              set("waking");
              setNudge(null);
              mouseDownAt.current = null;
              return;
            }
            if (open === "none") {
              await refreshClip();
              setOpen("menu");
              set("idlehop"); // he jumps, the bar rises above him
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
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 204,
          height: 240,
          cursor: dragging ? "grabbing" : "grab",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${data.settings.plantScale ?? 1})`,
            transformOrigin: "bottom center",
            transition: "transform 0.2s ease",
          }}
        >
          <Blob state={state} sproutStage={sproutStage} scribbling={scribbling} />
        </div>
      </div>

      {debugOpen && (
        <div style={{ position: "absolute", inset: 6, pointerEvents: "auto" }}>
          <DebugMenu
            current={state}
            sprout={sproutStage}
            onState={set}
            onTestNudge={(k) => triggerNudge(k)}
            onTestJoke={() => void tellJoke()}
            soundsOn={data.settings.soundsOn}
            onToggleSounds={() => update((d) => { d.settings.soundsOn = !d.settings.soundsOn; return d; })}
            onSprout={() => showToast("sprout now grows with your day 🌱")}
            onClose={() => setDebugOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
