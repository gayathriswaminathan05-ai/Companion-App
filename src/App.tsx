import { useEffect, useRef, useState, type CSSProperties } from "react";
import Blob from "./character/Blob";
import DebugMenu from "./DebugMenu";
import RadialMenu, { type RadialItem } from "./ui/RadialMenu";
import TaskPanel from "./ui/TaskPanel";
import ChatPanel from "./ui/ChatPanel";
import BreathingPanel from "./ui/BreathingPanel";
import ReminderBubble, { FiredReminder } from "./ui/ReminderBubble";
import NudgeBubble from "./ui/NudgeBubble";
import QuickNav, { type QuickNavItem } from "./ui/QuickNav";
import Showcase from "./ui/Showcase";
import GrowthTestBar from "./ui/GrowthTestBar";
import ReminderTestPanel, { type ReminderTestKind } from "./ui/ReminderTestPanel";
import JokeBubble from "./ui/JokeBubble";
import WelcomeMicBubble from "./ui/WelcomeMicBubble";
import { reminderPose } from "./reminderPose";
import SettingsPanel from "./ui/SettingsPanel";
import PanelResizeHandles from "./ui/PanelResizeHandles";
import { GrowthIcon } from "@/components/panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePanelTheme } from "./usePanelTheme";
import { speak, prefetchSpeech, stopSpeaking, setVoiceEnabled, warmUpVoice, accentForLocale, type CloudVoice } from "./voice";
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
import { EdgeClipContext } from "./edgeClip";
import { FEATURES } from "./features";
import { SPRITES } from "./generated/sprites";
import type { CharacterState } from "./character/types";

// Which stage→stage clap-and-grow transition clips are actually processed.
const TRANSITION_CLIPS = new Set<CharacterState>(
  (["grow1to2", "grow2to3", "grow3to4", "grow4to5", "grow5to6", "grow6to7"] as CharacterState[]).filter(
    (k) => (SPRITES as Record<string, unknown>)[k],
  ),
);

declare global {
  interface Window {
    companion: {
      isPackaged?: boolean;
      setClickThrough: (ignore: boolean) => void;
      focusControls?: () => void;
      cursorClientPos: () => Promise<{ x: number; y: number } | null>;
      dragStart: () => void;
      dragEnd: () => void;
      hide: () => void;
      quit: () => void;
      dataLoad: () => Promise<unknown>;
      dataSave: (data: unknown) => Promise<unknown> | void;
      layoutInfo: () => Promise<unknown>;
      setWindowSize: (size: { width: number; height: number; plantTop?: number; plantH?: number }) => Promise<unknown>;
      ensureMic: () => Promise<unknown>;
      voiceWarmup?: () => Promise<unknown>;
      voiceSynthesize?: (req: { text: string; voice?: string; speed?: number }) => Promise<unknown>;
      voiceStatus?: () => Promise<unknown>;
      voiceCloudInfo?: () => Promise<{ available: boolean; systemLocale: string }>;
      screenAccess: (opts?: { prompt?: boolean }) => Promise<string>;
      backdropLuminance: (area: { top: number; bottom: number }) => Promise<number | null>;
      idleSeconds: () => Promise<unknown>;
      transcribe: (audioBuffer: ArrayBuffer) => Promise<unknown>;
      brainStatus: () => Promise<unknown>;
      brainConnect: (key: string) => Promise<unknown>;
      chatCancel?: () => Promise<unknown>;
      chatSend: (payload: unknown) => Promise<unknown>;
      brainOnce: (payload: unknown) => Promise<unknown>;
      onChatEvent: (channel: string, handler: (data: unknown) => void) => () => void;
      openLink: (url: string) => void;
      setCallAutohide: (on: boolean) => void;
      getLoginItem: () => Promise<unknown>;
      setLoginItem: (on: boolean) => Promise<unknown>;
      brainDisconnect: () => Promise<unknown>;
      dataReset: () => Promise<unknown>;
      calendarStatus: () => Promise<{ hasClient: boolean; connected: boolean; canCreateEvents?: boolean; gmail?: boolean }>;
      calendarCreateEvent: (ev: {
        title: string;
        start: string;
        end?: string;
        attendees?: string[];
      }) => Promise<{ ok: boolean; error?: string; needsReconnect?: boolean; start?: string }>;
      gmailSetEnabled: (on: boolean) => Promise<{ ok: boolean; enabled: boolean; active: boolean }>;
      onGmailNew: (handler: (m: { id: string; from: string; subject: string; count?: number }) => void) => () => void;
      onGoogleAuthExpired: (handler: () => void) => () => void;
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

/** "Thu 3:00 PM" for booking confirmations (local time). */
function formatBooking(start: string): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  const today = new Date().toDateString() === d.toDateString();
  const day = today ? "today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function App() {
  const { state, set } = useCharacter();
  const [data, setData] = useState<AppData>(emptyData());
  const [open, setOpen] = useState<"none" | "menu" | "tasks" | "chat" | "settings" | "breathe" | "tests" | "test-preview">("none");
  const [testPreview, setTestPreview] = useState<{
    kind: ReminderTestKind; text: string; punchline?: string; revealed?: boolean; reminder?: FiredReminder;
  } | null>(null);
  const [clip, setClip] = useState<Clip>(EMPTY_CLIP);
  // Plant near the TOP of the screen → plant at the top of the window and all
  // UI opens below it ("flip"). relayout hides everything for the couple of
  // frames while the window shifts so the plant never visibly jumps.
  const [flip, setFlip] = useState(false);
  const flipRef = useRef(false);
  const [relayout, setRelayout] = useState(true);
  const layoutRef = useRef({ plantH: 240, need: 400 });
  const placedOnce = useRef(false);
  const [firedQueue, setFiredQueue] = useState<FiredReminder[]>([]);
  const firedQueueRef = useRef(firedQueue);
  firedQueueRef.current = firedQueue;
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

  const unhideSoon = () => requestAnimationFrame(() => requestAnimationFrame(() => setRelayout(false)));
  /** Is there room for the panels above the plant? If not (plant near the top
   *  of the screen) flip the UI below it. Hysteresis avoids flip-flopping.
   *  Returns true when the layout changed (the window will shift next). */
  const decideFlip = (raw: unknown): boolean => {
    const r = raw as { winY?: number; workTop?: number; workBottom?: number; plantTop?: number } | null;
    if (!r || ![r.winY, r.workTop, r.workBottom, r.plantTop].every((v) => Number.isFinite(v))) return false;
    const { plantH: ph, need } = layoutRef.current;
    const top = r.winY! + r.plantTop!;
    const above = top - r.workTop!;
    const below = r.workBottom! - (top + ph);
    const was = flipRef.current;
    const want = was ? above < need + 40 && below >= above : above < need && below > above;
    if (want === was) return false;
    flipRef.current = want;
    setRelayout(true);
    setFlip(want);
    return true;
  };
  /** After the plant was dropped somewhere new: edge clips + above/below. */
  const placeAfterMove = async () => {
    try {
      const raw = await window.companion.layoutInfo();
      setClip(normalizeClip(raw as Partial<Clip>));
      decideFlip(raw);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setSoundsEnabled(d.settings.soundsOn);
      setTimeout(() => chirp("hello"), 600);
      if (!d.settings.welcomed) {
        setTimeout(() => {
          setWelcome(true);
          set("waving");
        }, 1200);
      }
    });
    window.companion?.setClickThrough(true);
    void refreshClip();
    const stop = () => {
      setDragging((was) => {
        if (was) {
          window.companion?.dragEnd();
          stopDangle();
          set("idle");
          // New spot may be in a screen corner / near the top: re-measure so
          // bubbles, tooltips and panels open where they fit.
          window.setTimeout(() => void placeAfterMove(), 120);
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
    const apply = (ignore: boolean) => {
      // Resize handles also change native click-through. A renderer-local
      // cache can therefore disagree with the real window and strand buttons.
      // Deduplicate in the main process, where every request is observed.
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
    const focusControls = (e: PointerEvent) => {
      if (e.isTrusted && e.target instanceof Element && e.target.closest("[data-hit]")) {
        window.companion?.focusControls?.();
      }
    };
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
    document.addEventListener("pointerdown", focusControls, true);
    document.documentElement.addEventListener("mouseleave", release);
    window.addEventListener("blur", release);
    apply(true);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", focusControls, true);
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
  type NudgeKind = "stretch" | "walk" | "water" | "bedtime";
  const [nudge, setNudge] = useState<NudgeKind | null>(null);
  const nudgeRef = useRef<NudgeKind | null>(null);
  useEffect(() => {
    nudgeRef.current = nudge;
  }, [nudge]);

  // --- Rest poses: after ~12 quiet minutes on idle the plant lounges for ~4
  // minutes, then comes back. Only poses with art for its CURRENT stage are
  // picked (hammock exists for every stage; the older poses only for stage 4),
  // so the plant never changes shape mid-nap. Any click/nudge/panel interrupts.
  const restUntil = useRef(0);
  const nextRestAt = useRef(Date.now() + 12 * 60_000);
  useEffect(() => {
    const REST_POSES: CharacterState[] = ["hammock", "lying", "meditate", "picnic", "groove", "hula"];
    const id = window.setInterval(() => {
      const s = stateRef.current;
      const resting = REST_POSES.includes(s);
      if (openRef.current !== "none" || nudgeRef.current || firedQueueRef.current.length) {
        nextRestAt.current = Date.now() + 12 * 60_000;
        return;
      }
      if (resting && Date.now() >= restUntil.current) {
        set("idle");
        nextRestAt.current = Date.now() + 12 * 60_000;
      } else if (s === "idle" && Date.now() >= nextRestAt.current) {
        const stage = growthStageFor(dataRef.current.sprout.points);
        const poses = REST_POSES.filter((p) => (stage === 4 ? SPRITES[p] : SPRITES[`${p}${stage}`])?.frames?.length);
        nextRestAt.current = Date.now() + 12 * 60_000;
        if (!poses.length) return;
        restUntil.current = Date.now() + 4 * 60_000;
        set(poses[Math.floor(Math.random() * poses.length)]);
      } else if (!resting && s !== "idle") {
        nextRestAt.current = Math.max(nextRestAt.current, Date.now() + 2 * 60_000);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [set]);
  const activeMsRef = useRef(0);
  const waterMsRef = useRef(0);
  const movementCount = useRef(0);

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

        if (d.settings.breakMins > 0 && activeMsRef.current >= d.settings.breakMins * 60_000) {
          const style = d.settings.movementStyle || "mixed";
          triggerNudge(style === "walk" || (style === "mixed" && movementCount.current++ % 2 === 1) ? "walk" : "stretch");
          return;
        }
        if (d.settings.waterNudge && waterMsRef.current >= (d.settings.waterMins || 120) * 60_000) {
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
    walk: "tiny adventure? take a short walk, or move in whatever way feels good for you.",
    water: "little water break?",
    bedtime: "I'm sleepy… don't stay up too late, okay?",
  };

  // --- Voice (on-device Kokoro) ---------------------------------------------
  // Speaks only when Blob is visible; never while hidden for a call.
  // Cloud voice (Google, accent per country) when online; `private` lines
  // (meeting titles, email senders) always stay on the on-device voice.
  const [cloudInfo, setCloudInfo] = useState<{ available: boolean; systemLocale: string }>({
    available: false,
    systemLocale: "",
  });
  const cloudInfoRef = useRef(cloudInfo);
  cloudInfoRef.current = cloudInfo;
  useEffect(() => {
    void window.companion.voiceCloudInfo?.().then((i) => i && setCloudInfo(i));
  }, []);
  const cloudVoiceFor = (st: typeof data.settings): CloudVoice | null => {
    if (!cloudInfoRef.current.available) return null;
    const lang = st.voiceAccent && st.voiceAccent !== "auto" ? st.voiceAccent : accentForLocale(cloudInfoRef.current.systemLocale);
    return { languageCode: lang, voiceName: `${lang}-Chirp3-HD-${st.cloudVoice || "Puck"}` };
  };
  const voiceOpts = (priv = false) => {
    const st = dataRef.current.settings;
    return { voice: st.voiceName || "af_heart", speed: st.voiceName === "af_bella" ? 1.0 : undefined, cloud: priv ? null : cloudVoiceFor(st) };
  };
  const canSpeak = () => !!dataRef.current.settings.voiceOn && document.visibilityState !== "hidden";
  const say = (text: string, opts: { private?: boolean } = {}) => {
    if (!canSpeak()) return;
    void speak(text, voiceOpts(opts.private));
  };
  /** Get a line we'll say next ready now, so it plays with no pause. */
  const presay = (text: string) => {
    if (canSpeak()) prefetchSpeech(text, voiceOpts());
  };

  // --- Chat brain -----------------------------------------------------------
  const [brainConnected, setBrainConnected] = useState(false);
  const [brainViaProxy, setBrainViaProxy] = useState(false);
  const aiName = "ChatGPT";
  const refreshBrainStatus = () =>
    (
      window.companion.brainStatus() as Promise<{ connected: boolean; viaProxy?: boolean }>
    ).then((s) => {
      setBrainConnected(!!s?.connected);
      setBrainViaProxy(!!s?.viaProxy);
    });
  const [streamText, setStreamText] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const streamRef = useRef("");
  const activeChatId = useRef<string | null>(null);
  const cancelCurrentChat = async () => {
    activeChatId.current = null;
    streamRef.current = "";
    setStreamText(null);
    setChatBusy(false);
    stopSpeaking();
    await window.companion.chatCancel?.();
  };

  // While chat is open, stay on coffee sip — timed poses (celebrate/write)
  // auto-return to idle; nudge back so the yellow blob never shows.
  useEffect(() => {
    if (open === "chat" && !chatBusy && (state === "idle" || state === "thinking" || state === "listening")) {
      set("coffee");
    }
  }, [open, chatBusy, state, set]);

  useEffect(() => {
    if (!FEATURES.aiChat) return;
    void refreshBrainStatus();
    const offChunk = window.companion.onChatEvent("chat-chunk", (d) => {
      const { id, delta } = d as { id: string; delta: string };
      if (id !== activeChatId.current || dataRef.current.settings.chatConsentVersion !== 1) return;
      streamRef.current += delta;
      setStreamText(streamRef.current);
    });
    const offDone = window.companion.onChatEvent("chat-done", (d) => {
      const { id, text, sources } = d as { id: string; text: string; sources?: { title: string; url: string }[] };
      if (id !== activeChatId.current || dataRef.current.settings.chatConsentVersion !== 1) return;
      activeChatId.current = null;
      const { clean, facts, tasks, completes, meetings } = extractOutputs(text);
      if (meetings.length) setBooking(meetings[0]);
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
      if (clean && dataRef.current.settings.voiceChat) say(clean);
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
      const { id, error } = d as { id: string; error: string };
      if (id !== activeChatId.current || dataRef.current.settings.chatConsentVersion !== 1) return;
      activeChatId.current = null;
      update((x) => {
        const friendly = error.includes("daily_limit")
          ? "we've chatted SO much today, my brain needs a nap 😴 I'll be fully back tomorrow morning!"
          : error.includes("credit balance") || /quota|billing/i.test(error)
          ? "my thinking credits ran out 😅 add credits on my AI account's Billing page and I'll be right back!"
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
    if (!FEATURES.aiChat || dataRef.current.settings.chatConsentVersion !== 1 || activeChatId.current) return;
    stopSpeaking();
    const id = crypto.randomUUID();
    activeChatId.current = id;
    const draft = structuredClone(dataRef.current);
    draft.chat.messages.push({ role: "user", text, at: new Date().toISOString() });
    dataRef.current = draft;
    setData(draft);
    setChatBusy(true);
    streamRef.current = "";
    setStreamText("");
    set("coffee");
    void (async () => {
      try {
        const saved = await window.companion.dataSave(draft);
        if (saved === false) throw new Error("save-failed");
        let canBookMeetings = false;
        try { canBookMeetings = !!(await window.companion.calendarStatus?.())?.canCreateEvents; } catch {}
        // History/key deletion may have happened while saving or checking Calendar.
        if (activeChatId.current !== id || dataRef.current.settings.chatConsentVersion !== 1) return;
        const result = await window.companion.chatSend({
          id, system: buildSystem(draft, { canBookMeetings }), messages: buildMessages(draft),
        }) as { ok?: boolean };
        if (result?.ok === false && activeChatId.current === id) throw new Error("chat-unavailable");
      } catch {
        if (activeChatId.current !== id) return;
        activeChatId.current = null;
        setChatBusy(false);
        setStreamText(null);
        showToast("Couldn't send. Please try again.");
      }
    })();
  };

  const connectBrain = async (key: string) => {
    const res = (await window.companion.brainConnect(key)) as { ok: boolean; error?: string };
    if (res?.ok) {
      setBrainConnected(true);
      void refreshBrainStatus();
      showToast("Brain connected");
    } else {
      showToast(res?.error || "Hmm, couldn't save the key");
    }
  };

  // --- Jokes: every ~3 hours, "what do you call…?" ---------------------------
  const [joke, setJoke] = useState<{ setup: string; punchline: string; revealed: boolean } | null>(null);
  const jokeRef = useRef(joke);
  useEffect(() => {
    jokeRef.current = joke;
  }, [joke]);

  // Google Calendar meeting ping — RAM only; never saved / never sent to the AI.
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

  // First launch: a short hello so testers know what to do.
  const [welcome, setWelcome] = useState(false);
  const finishWelcome = () => {
    setWelcome(false);
    update((d) => {
      d.settings.welcomed = true;
      return d;
    });
    set("idle");
  };

  // Calendar booking Blob drafted in chat: waits for a one-tap Add.
  const [booking, setBooking] = useState<{ title: string; start: string; end?: string; attendees?: string[] } | null>(null);
  const confirmBooking = async () => {
    const b = booking;
    setBooking(null);
    if (!b) return;
    const res = await window.companion.calendarCreateEvent?.(b);
    if (res?.ok) {
      showToast("Added to your calendar");
      set("celebrating");
      chirp("celebrate");
    } else if (res?.needsReconnect) {
      showToast("Reconnect Google in Settings first");
    } else {
      showToast("Couldn't add it to your calendar");
    }
  };

  // New Gmail (Primary inbox): sender + subject live in RAM only, never saved
  // or sent to the AI.
  const [mail, setMail] = useState<{ from: string; subject: string; count?: number } | null>(null);
  useEffect(() => {
    void window.companion.gmailSetEnabled?.(FEATURES.gmailAlerts && !!data.settings.gmailAlerts);
  }, [data.settings.gmailAlerts]);
  useEffect(() => {
    const offMail = window.companion.onGmailNew?.((m) => {
      if (!FEATURES.gmailAlerts || !dataRef.current.settings.gmailAlerts) return;
      if (document.visibilityState === "hidden") return;
      if (stateRef.current === "sleeping" || stateRef.current === "dragged") return;
      setMail({ from: m.from, subject: m.subject, count: m.count });
      chirp("pop");
    });
    const offExpired = window.companion.onGoogleAuthExpired?.(() => {
      showToast("Google needs a quick reconnect in Settings");
    });
    return () => {
      offMail?.();
      offExpired?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jokes come from the plant's own joke book (src/jokes.ts, 300+): instant,
  // offline, free, hand-picked. The last 250 told are skipped so it takes
  // months before one comes back.
  const tellJoke = async () => {
    const recent = dataRef.current.chat.jokeRecent ?? [];
    const j = pickFallbackJoke(recent);
    setJoke({ setup: j.setup, punchline: j.punchline, revealed: false });
    set("waving");
    chirp("pop");
    update((d) => {
      d.chat.jokeLastAt = new Date().toISOString();
      const key = jokeKey(j.setup);
      const next = [...(d.chat.jokeRecent ?? []).filter((x) => jokeKey(x) !== key), key];
      d.chat.jokeRecent = next.slice(-250);
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
        chirp("bell");
        try {
          new Notification("Your companion 🌱", { body: `⏰ ${t.text}` });
        } catch {}
        // The visible queue item selects its pose below, not the last due task.
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
      set("idle");
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
    const next = structuredClone(dataRef.current);
    next.settings = { ...next.settings, ...patch };
    dataRef.current = next;
    setData(next);
    void window.companion.dataSave(next);
  };

  const showToast = (msg: string, stage?: GrowthStage) => {
    setToast({ text: msg, stage });
    setTimeout(() => setToast(null), 2200);
  };

  const growthStage = growthStageFor(data.sprout.points);
  const week = ensureWeek(data.week);
  const panelOpen = open === "tasks" || open === "chat" || open === "settings" || open === "breathe" || open === "tests";

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
  // FLIP_PAD: room above the plant when it sits at the window top (the hop and
  // poses drawn taller than the plant box).
  const FLIP_PAD = 80;
  const WIN_H = Math.max(
    BASE_H,
    Math.ceil(FLIP_PAD + plantH + PLANT_GAP + PANEL_H + STACK_GAP + NAV_H + 20),
  );
  const plantTopY = flip ? FLIP_PAD : WIN_H - plantH; // plant box inside the window
  const plantBottomY = plantTopY + plantH;
  const stackSpan = PANEL_H + STACK_GAP + NAV_H;
  layoutRef.current = { plantH, need: stackSpan + PLANT_GAP + 16 };
  const PANEL_W = WIN_W - uiPad * 2;
  const visL = clip.clipLeft + uiPad;
  const visR = WIN_W - clip.clipRight - uiPad;
  const availW = Math.max(0, visR - visL);
  const panelW = availW > 0 ? Math.min(PANEL_W, availW) : PANEL_W;
  let panelLeft = uiPad;
  if (panelLeft < visL) panelLeft = visL;
  if (panelLeft + panelW > visR) panelLeft = Math.max(visL, visR - panelW);
  // Keeps the stack glued to the plant: above it normally (distance from the
  // window bottom), below it when flipped (distance from the window top).
  const stackBottom = WIN_H - plantTopY + PLANT_GAP;
  const stackTop = plantBottomY + PLANT_GAP;
  const stackPos: CSSProperties = flip ? { top: stackTop } : { bottom: stackBottom };
  // Speech bubbles (w-64) sit over the plant but slide inward when the plant
  // is in a screen corner; the tail keeps pointing at the plant.
  const BUBBLE_W = 256;
  const plantCx = WIN_W / 2;
  const bubbleLeft = Math.max(visL, Math.min(plantCx - BUBBLE_W / 2, visR - BUBBLE_W));
  const bubbleTail = Math.max(22, Math.min(BUBBLE_W - 22, plantCx - bubbleLeft));
  const edgeClip = { left: clip.clipLeft, right: clip.clipRight, top: clip.clipTop, bottom: clip.clipBottom };

  // Voice: mute switch + warm the model a little after launch (it's ~450MB
  // of RAM, so only when the voice is on).
  useEffect(() => {
    setVoiceEnabled(!!data.settings.voiceOn);
    if (!data.settings.voiceOn) {
      stopSpeaking();
      return;
    }
    if (cloudInfo.available) return; // on-device voice loads on demand as backup
    const t = window.setTimeout(() => void warmUpVoice(), 8000);
    return () => window.clearTimeout(t);
  }, [data.settings.voiceOn, cloudInfo.available]);

  const firedNow = firedQueue[0];
  useEffect(() => {
    if (!firedNow) return;
    set(reminderPose(firedNow.text));
    say(firedNow.missed ? `while you were away: ${firedNow.text}` : `hey! it's time: ${firedNow.text}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firedNow?.id]);
  useEffect(() => {
    if (!meeting) return;
    say(
      meeting.minutesUntil <= 0 ? `${meeting.title} is starting now` : `heads up, ${meeting.title} starts in ${meeting.minutesUntil} minutes`,
      { private: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting]);
  useEffect(() => {
    if (nudge) say(NUDGE_TEXT[nudge]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);
  // Joke voice: ask the question, and meanwhile prepare the punchline (plus the
  // plant laughing at its own joke) so it plays the instant "What?" is tapped.
  const withLaugh = (punchline: string) => `${punchline.replace(/[.!?\s]+$/, "")}! Ha ha ha!`;
  useEffect(() => {
    if (!joke) return;
    if (joke.revealed) {
      say(withLaugh(joke.punchline));
    } else {
      say(joke.setup);
      presay(withLaugh(joke.punchline));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joke?.setup, joke?.revealed]);
  useEffect(() => {
    // Sender only, never the subject out loud (someone may be nearby).
    if (mail) say(mail.count ? `you've got ${mail.count} new emails` : `new email from ${mail.from || "someone"}`, { private: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail]);
  useEffect(() => {
    if (welcome) say("hi! I'm your little desk plant. Tap me for tasks, breathing and settings. You can enable the microphone to dictate tasks and answer my jokes.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);
  useEffect(() => {
    if (open !== "chat") stopSpeaking();
  }, [open]);

  // Development previews share the real bubble/pose/voice, but never call the
  // scheduling or completion handlers that write tasks, nudge caps or points.
  const playReminderTest = (kind: ReminderTestKind) => {
    if (window.companion.isPackaged !== false) return;
    if (firedQueue.length || meeting || nudge || joke || booking || mail || welcome) {
      showToast("Dismiss the current alert, then try the preview.");
      return;
    }
    setDebugOpen(false);
    setShowcase(false);
    setToast(null);
    setOpen("test-preview");
    if (kind === "joke") {
      const sample = pickFallbackJoke(dataRef.current.chat.jokeRecent ?? []);
      setTestPreview({ kind, text: sample.setup, punchline: sample.punchline, revealed: false });
      set("waving");
      chirp("pop");
    } else if (kind === "stretch" || kind === "walk" || kind === "water" || kind === "bedtime") {
      setTestPreview({ kind, text: NUDGE_TEXT[kind] });
      set(kind === "bedtime" ? "sleeping" : kind === "water" ? "watering" : "stretching");
      chirp(kind === "bedtime" ? "sleepy" : "pop");
    } else if (kind === "calendar" || kind === "calendar-now") {
      setTestPreview({ kind, text: kind === "calendar" ? '"Sample meeting" in 5 min' : '"Sample meeting" is starting now' });
      set("meeting");
      chirp("bell");
    } else {
      const text = { task: "Call a friend", missed: "Take a screen break", daily: "Daily reading break", meditation: "Meditation break", meal: "Meal break", coffee: "Tea or coffee break" }[kind];
      setTestPreview({ kind, text, reminder: { id: "test-preview", text, timeLabel: kind === "missed" ? "10 minutes ago" : "now", missed: kind === "missed", recurring: kind === "daily" ? "daily" : undefined } });
      set(reminderPose(text));
      chirp("bell");
    }
  };
  const finishReminderTest = (snoozed = false) => {
    stopSpeaking();
    setTestPreview(null);
    setOpen("tests");
    set("idle");
    if (snoozed) showToast("Test only: no reminder was rescheduled.");
  };
  // A real alert always takes priority. Leaving a preview cancels its speech.
  useEffect(() => {
    if (!testPreview) {
      if (open === "test-preview" && !firedQueue.length && !meeting && !nudge && !joke && !booking && !mail && !welcome) setOpen("tests");
      return;
    }
    if (open !== "test-preview" || firedQueue.length || meeting || nudge || joke || booking || mail || welcome) {
      setTestPreview(null);
      return;
    }
    say(testPreview.revealed && testPreview.punchline ? withLaugh(testPreview.punchline)
      : testPreview.reminder ? `${testPreview.reminder.missed ? "while you were away" : "hey! it's time"}: ${testPreview.text}`
      : testPreview.text, { private: true });
  }, [testPreview, open, firedQueue.length, meeting, nudge, joke, booking, mail, welcome]);

  // Panels: follow macOS light/dark, or (opt-in) match the app behind us.
  usePanelTheme(
    !!data.settings.matchBackdrop,
    panelOpen || open === "menu" || showcase || firedQueue.length > 0 || !!nudge || !!joke || !!meeting || !!testPreview,
    flip
      ? { top: stackTop, bottom: stackTop + stackSpan }
      : { top: Math.max(0, plantTopY - PLANT_GAP - stackSpan), bottom: Math.max(0, plantTopY - PLANT_GAP) },
  );

  // Keep the Electron window sized for the panel scale and tell main where the
  // plant sits inside it; main shifts the window so the plant stays put.
  useEffect(() => {
    void (async () => {
      try {
        const raw = await window.companion.setWindowSize({ width: WIN_W, height: WIN_H, plantTop: plantTopY, plantH });
        setClip(normalizeClip(raw as Partial<Clip>));
        // First placement after launch: the saved spot may be near the top.
        if (!placedOnce.current) {
          placedOnce.current = true;
          if (decideFlip(raw)) return; // layout flips → this effect runs again
        }
      } catch {
        /* ignore */
      }
      unhideSoon();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WIN_W, WIN_H, plantTopY, plantH]);

  // Refresh edge clips when UI opens — never nudge the window/plant.
  // Speech bubbles / toasts too (the window can be moved by a display change).
  const bubbleUp = !!(firedQueue.length || meeting || welcome || booking || mail || joke || nudge || toast || testPreview);
  useEffect(() => {
    if (panelOpen || open === "menu" || showcase || bubbleUp) void refreshClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, open, showcase, bubbleUp]);

  return (
    <EdgeClipContext.Provider value={edgeClip}>
    <TooltipProvider delayDuration={350}>
    <div
      style={
        {
          width: "100%",
          height: "100%",
          position: "relative",
          pointerEvents: "none",
          "--bubble-left": `${bubbleLeft}px`,
          "--bubble-tail": `${bubbleTail}px`,
          "--bubble-top": `${plantBottomY + 10}px`,
          opacity: relayout ? 0 : 1,
        } as CSSProperties
      }
      className={flip ? "ui-flip" : undefined}
    >
      {panelOpen && (
        <div
          style={{
            position: "absolute",
            left: panelLeft,
            width: panelW,
            ...stackPos,
            display: "flex",
            // Flipped: panel right under the plant, QuickNav below it.
            flexDirection: flip ? "column-reverse" : "column",
            alignItems: "center",
            gap: STACK_GAP,
            pointerEvents: "none",
            zIndex: 10, // Controls must stay above the plant's drag/click surface.
          }}
        >
          <QuickNav
            items={([
              { icon: "chat", label: "chat", active: open === "chat", onClick: () => { setOpen("chat"); if (!chatBusy) set("coffee"); } },
              { icon: "tasks", label: "tasks", active: open === "tasks", onClick: () => { setOpen("tasks"); set("noting"); } },
              { icon: "breathe", label: "breathe", active: open === "breathe", onClick: () => { if (open !== "breathe") { setOpen("breathe"); set("meditate"); } } },
              { icon: "settings", label: "settings", active: open === "settings", onClick: () => { setOpen("settings"); set("idle"); } },
              { icon: "tuck", label: "nap", onClick: () => { setOpen("none"); window.companion?.hide(); } },
            ] satisfies QuickNavItem[]).filter(item => FEATURES.aiChat || item.label !== "chat")}
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
            {open === "tests" && window.companion.isPackaged === false && (
              <ReminderTestPanel onPlay={playReminderTest} voiceOn={!!data.settings.voiceOn} soundsOn={data.settings.soundsOn}
                onClose={() => { setOpen("settings"); set("idle"); }} />
            )}
            {open === "breathe" && (
              <BreathingPanel
                voiceOn={!!data.settings.voiceOn}
                interrupted={chatBusy || firedQueue.length > 0 || !!meeting || !!nudge || !!booking || !!mail || dragging}
                onActiveChange={(active) => { if (active) { stopSpeaking(); set("meditate"); } }}
                onComplete={() => { activeMsRef.current = 0; }}
                onClose={() => { setOpen("none"); if (stateRef.current === "meditate") set("idle"); }}
              />
            )}
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
                onOpenReminderTests={window.companion.isPackaged === false ? () => { setOpen("tests"); set("idle"); } : undefined}
                onScheduleMeditation={(due, recurring) => addTask("Meditation break", due, recurring)}
                settings={data.settings}
                facts={data.chat.facts}
                week={week}
                growthStage={growthStage}
                points={data.sprout.date === today() ? data.sprout.points : 0}
                onPatch={patchSettings}
                onDeleteFact={async (f) => {
                  const next = structuredClone(dataRef.current);
                  next.chat.facts = next.chat.facts.filter((x) => x !== f);
                  if (await window.companion.dataSave(next) === false) {
                    showToast("Could not remove the saved note. Please retry.");
                    return;
                  }
                  dataRef.current = next;
                  setData(next);
                }}
                onClearChat={async () => {
                  await cancelCurrentChat();
                  const next = structuredClone(dataRef.current);
                  next.chat.messages = [];
                  next.chat.summary = "";
                  dataRef.current = next;
                  setData(next);
                  setStreamText(null);
                  if (await window.companion.dataSave(next) === false) throw new Error("save-failed");
                }}
                showKeyRow={FEATURES.aiChat && (!brainViaProxy || !window.companion.isPackaged)}
                hasChatHistory={data.chat.messages.length > 0 || !!data.chat.summary}
                aiName={aiName}
                cloudVoice={{ available: cloudInfo.available, autoAccent: accentForLocale(cloudInfo.systemLocale) }}
                onChangeKey={async () => {
                  await cancelCurrentChat();
                  if (await window.companion.brainDisconnect() === false) {
                    showToast("Could not remove the key. Please try again.");
                    return;
                  }
                  setBrainConnected(false);
                  setOpen("chat");
                  set("coffee");
                }}
                onDeleteAll={async () => {
                  await cancelCurrentChat();
                  const result = await window.companion.dataReset() as { ok?: boolean };
                  if (!result?.ok) throw new Error("reset-failed");
                }}
                onClose={() => {
                  setOpen("none");
                  set("idle");
                }}
              />
            )}
            {FEATURES.aiChat && open === "chat" && (
              <ChatPanel
                privacyAccepted={data.settings.chatConsentVersion === 1}
                aiName={aiName}
                onAcceptPrivacy={() => patchSettings({ chatConsentVersion: 1 })}
                messages={data.chat.messages}
                streamText={streamText}
                busy={chatBusy}
                connected={brainConnected}
                companionName={data.settings.companionName}
                userName={data.settings.userName}
                voiceChat={data.settings.voiceOn && data.settings.voiceChat}
                onToggleVoiceChat={() => {
                  const next = !(data.settings.voiceOn && data.settings.voiceChat);
                  if (!next) stopSpeaking();
                  patchSettings(next ? { voiceOn: true, voiceChat: true } : { voiceChat: false });
                }}
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
            ...stackPos,
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
          winW={WIN_W}
          plantTop={plantTopY}
          plantBottom={plantBottomY}
          below={flip}
          clipLeft={clip.clipLeft}
          clipRight={clip.clipRight}
          clipTop={clip.clipTop}
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
          items={([
            { icon: "chat", label: "chat", onClick: () => { setOpen("chat"); set("coffee"); } },
            {
              icon: "tasks",
              label: "tasks",
              onClick: () => {
                setOpen("tasks");
                set("noting"); // notepad out, spectacles on, pen ready
              },
            },
            { icon: "breathe", label: "breathe", onClick: () => { setOpen("breathe"); set("meditate"); } },
            { icon: "settings", label: "settings", onClick: () => setOpen("settings") },
            {
              icon: "tuck",
              label: "nap",
              onClick: () => {
                setOpen("none");
                window.companion?.hide();
              },
            },
          ] satisfies RadialItem[]).filter(item => FEATURES.aiChat || item.label !== "chat")}
        />
      )}

      {testPreview && open === "test-preview" && !firedQueue.length && !meeting && !nudge && !joke && !booking && !mail && !welcome && (
        testPreview.reminder ? (
          <ReminderBubble preview fired={testPreview.reminder} onDone={() => finishReminderTest()} onSnooze={() => finishReminderTest(true)} />
        ) : testPreview.kind === "joke" ? (
          <JokeBubble key={testPreview.text} preview setup={testPreview.text} punchline={testPreview.punchline!} revealed={!!testPreview.revealed}
            onReveal={() => { setTestPreview({ ...testPreview, revealed: true }); set("celebrating"); chirp("giggle"); }}
            onDismiss={() => finishReminderTest()} />
        ) : (
          <NudgeBubble preview text={testPreview.revealed ? testPreview.punchline! : testPreview.text}
            actions={testPreview.kind === "stretch" || testPreview.kind === "walk" || testPreview.kind === "water" ? [
              { label: "Did it", primary: true, onClick: () => finishReminderTest() },
              { label: "Not now", onClick: () => finishReminderTest() },
            ] : [{ label: testPreview.kind === "bedtime" ? "Good night" : "Got it", primary: true, onClick: () => finishReminderTest() }]} />
        )
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

      {welcome && firedQueue.length === 0 && !meeting && !nudge && !joke && (
        <WelcomeMicBubble onFinish={finishWelcome} />
      )}

      {booking && firedQueue.length === 0 && !meeting && !welcome && (
        <NudgeBubble
          text={`Add "${booking.title}" on ${formatBooking(booking.start)} to your Google Calendar?`}
          actions={[
            { label: "Add", primary: true, onClick: () => void confirmBooking() },
            { label: "Not now", onClick: () => setBooking(null) },
          ]}
        />
      )}

      {mail && firedQueue.length === 0 && !meeting && !booking && (
        <NudgeBubble
          text={
            mail.count
              ? `${mail.count} new emails just landed in your inbox`
              : `New email from ${mail.from || "someone"}: ${mail.subject ? `"${mail.subject}"` : "(no subject)"}`
          }
          actions={[{ label: "Got it", primary: true, onClick: () => setMail(null) }]}
        />
      )}

      {joke && firedQueue.length === 0 && !nudge && !meeting && !booking && !mail && (
        <JokeBubble key={joke.setup} setup={joke.setup} punchline={joke.punchline} revealed={joke.revealed}
          onReveal={() => { setJoke({ ...joke, revealed: true }); set("celebrating"); chirp("giggle"); }}
          onDismiss={() => { setJoke(null); set("idle"); stopSpeaking(); }} />
      )}

      {nudge && firedQueue.length === 0 && !meeting && !booking && !mail && (
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
        // Centred in the on-screen part of the window (plant may be in a corner).
        <div
          className="absolute z-30 flex justify-center"
          style={{ left: visL, width: Math.max(0, visR - visL), ...(flip ? { top: plantBottomY + 10 } : { bottom: 216 }) }}
        >
          <div
            key={toast.text}
            data-slot="toast"
            role="status"
            className="inline-flex h-8 max-w-full animate-toast-in items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] font-medium whitespace-nowrap text-background shadow-float"
          >
            {toast.stage && <GrowthIcon stage={toast.stage} className="size-5" />}
            <span className="truncate">{toast.text}</span>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: WIN_H - plantBottomY, // 0 normally; plant at the window top when flipped
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
        {/* Scale the hit layer with the artwork. An unscaled 240px layer
            overlaps panel footers when the owner chooses a smaller plant.
            Receives drag/click only while click-through is off
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
            if (!window.companion?.isPackaged) setDebugOpen((o) => !o);
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
      </div>

      {/* Always-on growth test strip (beside plant) — idle stages + level-up clips */}
      {!window.companion?.isPackaged && (
      <GrowthTestBar
        bottom={WIN_H - plantBottomY + 16}
        growthStage={growthStage}
        visible={data.settings.growthTestVisible && !welcome && open !== "tests" && open !== "test-preview"}
        onVisibleChange={(v) =>
          update((d) => {
            d.settings.growthTestVisible = v;
            return d;
          })
        }
        onIdleStage={(s) =>
          update((d) => {
            if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
            d.sprout.points = s === 1 ? 0 : s === 2 ? 2 : s === 3 ? 4 : s === 4 ? 6 : s === 5 ? 8 : s === 6 ? 10 : 12;
            return d;
          })
        }
        onPlayTransition={(from, to) => {
          const key = `grow${from}to${to}` as CharacterState;
          if (!TRANSITION_CLIPS.has(key)) return;
          // Land on destination stage so idle after the clip matches.
          update((d) => {
            if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
            d.sprout.points = to === 1 ? 0 : to === 2 ? 2 : to === 3 ? 4 : to === 4 ? 6 : to === 5 ? 8 : to === 6 ? 10 : 12;
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
      )}

      {debugOpen && (
        <div data-hit="1" style={{ position: "absolute", left: clip.clipLeft + 8, top: clip.clipTop + 8, pointerEvents: "auto", zIndex: 50 }}>
          <DebugMenu
            current={state}
            growthStage={growthStage}
            onState={set}
            onTestNudge={playReminderTest}
            onTestJoke={() => playReminderTest("joke")}
            soundsOn={data.settings.soundsOn}
            onToggleSounds={() => update((d) => { d.settings.soundsOn = !d.settings.soundsOn; return d; })}
            onGrowthStage={(s) =>
              update((d) => {
                if (d.sprout.date !== today()) d.sprout = { date: today(), points: 0 };
                // Jump to the minimum points for that stage (preview only).
                d.sprout.points = s === 1 ? 0 : s === 2 ? 2 : s === 3 ? 4 : s === 4 ? 6 : s === 5 ? 8 : s === 6 ? 10 : 12;
                return d;
              })
            }
            onClose={() => setDebugOpen(false)}
          />
        </div>
      )}
    </div>
    </TooltipProvider>
    </EdgeClipContext.Provider>
  );
}
