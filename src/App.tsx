import { useEffect, useRef, useState } from "react";
import Blob from "./character/Blob";
import DebugMenu from "./DebugMenu";
import RadialMenu, { MenuPhase } from "./ui/RadialMenu";
import TaskPanel from "./ui/TaskPanel";
import ChatPanel from "./ui/ChatPanel";
import ReminderBubble, { FiredReminder } from "./ui/ReminderBubble";
import NudgeBubble from "./ui/NudgeBubble";
import { formatDue } from "./reminders";
import { useCharacter } from "./character/useCharacter";
import { AppData, emptyData, loadData, saveData, sproutStageFor, today } from "./store";
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
      dataSave: (data: unknown) => void;
      layoutInfo: () => Promise<unknown>;
      ensureMic: () => Promise<unknown>;
      idleSeconds: () => Promise<unknown>;
      transcribe: (audioBuffer: ArrayBuffer) => Promise<unknown>;
    };
  }
}

const hoverable = {
  onMouseEnter: () => window.companion?.setClickThrough(false),
  onMouseLeave: () => window.companion?.setClickThrough(true),
};

export default function App() {
  const { state, set } = useCharacter();
  const [data, setData] = useState<AppData>(emptyData());
  const [open, setOpen] = useState<"none" | "menu" | "tasks" | "chat">("none");
  const [clip, setClip] = useState({ clipLeft: 0, clipRight: 0 });
  const [menuPhase, setMenuPhase] = useState<MenuPhase>("juggling");
  const juggleTimer = useRef<number | null>(null);
  const [firedQueue, setFiredQueue] = useState<FiredReminder[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  useEffect(() => {
    loadData().then(setData);
    window.companion?.setClickThrough(true);
    const stop = () => {
      setDragging((was) => {
        if (was) {
          window.companion?.dragEnd();
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
    if (kind === "bedtime") {
      set("sleeping");
      update((d) => {
        d.wellness.bedtimeDate = today();
        return d;
      });
    } else {
      set("stretching");
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const sproutStage = sproutStageFor(data.sprout.points);
  const panelOpen = open === "tasks" || open === "chat";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "none" }}>
      {panelOpen && (
        <div {...hoverable} style={{ position: "absolute", top: 6, left: 6, right: 6, height: 280, pointerEvents: "auto" }}>
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
          {open === "chat" && (
            <ChatPanel
              onClose={() => {
                setOpen("none");
                set("idle");
              }}
              onBlobState={(s) => set(s as CharacterState)}
            />
          )}
        </div>
      )}

      {open === "menu" && (
        <RadialMenu
          phase={menuPhase}
          clipLeft={clip.clipLeft}
          clipRight={clip.clipRight}
          items={[
            { icon: "💬", label: "chat", onClick: () => setOpen("chat") },
            {
              icon: "📝",
              label: "tasks",
              onClick: () => {
                setOpen("tasks");
                set("noting"); // notepad out, spectacles on, pen ready
              },
            },
            {
              icon: "⚙️",
              label: "settings",
              onClick: () => {
                showToast("Settings arrive on Day 6!");
                setOpen("none");
              },
            },
            {
              icon: "💤",
              label: "tuck away",
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
              const info = (await window.companion.layoutInfo()) as {
                clipLeft: number;
                clipRight: number;
              };
              setClip(info);
              setMenuPhase("juggling");
              setOpen("menu");
              set("juggling");
              if (juggleTimer.current) clearTimeout(juggleTimer.current);
              juggleTimer.current = window.setTimeout(() => {
                setMenuPhase("thrown");
              }, 1100);
            } else {
              if (juggleTimer.current) clearTimeout(juggleTimer.current);
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
          width: 170,
          height: 200,
          cursor: dragging ? "grabbing" : "grab",
          pointerEvents: "auto",
        }}
      >
        <Blob state={state} sproutStage={sproutStage} scribbling={scribbling} />
      </div>

      {debugOpen && (
        <div style={{ position: "absolute", inset: 6, pointerEvents: "auto" }}>
          <DebugMenu
            current={state}
            sprout={sproutStage}
            onState={set}
            onTestNudge={(k) => triggerNudge(k)}
            onSprout={() => showToast("sprout now grows with your day 🌱")}
            onClose={() => setDebugOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
