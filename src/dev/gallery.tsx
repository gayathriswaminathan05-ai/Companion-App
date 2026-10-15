// Dev-only UI gallery: every panel / bubble / bar at real size on a fake
// desktop, so design passes can be reviewed in a browser without Electron.
// Open http://localhost:5173/gallery.html while `npx vite` runs. Never shipped
// (vite build only bundles index.html).
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import ChatPanel from "../ui/ChatPanel";
import TaskPanel from "../ui/TaskPanel";
import SettingsPanel from "../ui/SettingsPanel";
import RadialMenu from "../ui/RadialMenu";
import QuickNav from "../ui/QuickNav";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReminderBubble from "../ui/ReminderBubble";
import NudgeBubble from "../ui/NudgeBubble";
import { defaultSettings, type Todo } from "../store";
import type { ChatMsg } from "../brain";

const noop = () => {};
window.companion = {
  setClickThrough: noop,
  cursorClientPos: async () => null,
  dragStart: noop,
  dragEnd: noop,
  hide: noop,
  quit: noop,
  dataLoad: async () => null,
  dataSave: async () => null,
  layoutInfo: async () => null,
  setWindowSize: async () => null,
  ensureMic: async () => false,
  screenAccess: async () => "granted",
  backdropLuminance: async () => null,
  idleSeconds: async () => 0,
  transcribe: async () => "",
  brainStatus: async () => true,
  brainConnect: async () => true,
  chatSend: async () => null,
  brainOnce: async () => null,
  onChatEvent: () => noop,
  openLink: noop,
  setCallAutohide: noop,
  getLoginItem: async () => true,
  setLoginItem: async () => true,
  brainDisconnect: async () => null,
  dataReset: async () => null,
  calendarStatus: async () => ({ hasClient: true, connected: true }),
  calendarSaveClient: async () => ({ ok: true }),
  calendarConnect: async () => ({ ok: true }),
  calendarDisconnect: async () => ({ ok: true }),
  onCalendarMeeting: () => noop,
};

const H = 3600_000;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

const MESSAGES: ChatMsg[] = [
  { role: "user", text: "ugh my manager moved the review to friday", at: iso(now - 26 * H) },
  {
    role: "assistant",
    text: "WAIT. friday?? after you prepped all week?! okay okay — that's actually **more time to polish**. want me to set a reminder for thursday evening?",
    at: iso(now - 26 * H),
  },
  { role: "user", text: "yes pls, and find me a good cafe near indiranagar to work from", at: iso(now - 0.2 * H) },
  {
    role: "assistant",
    text: "done ✓ reminder set for thursday 7pm.\n\nhere are my top cafe picks:\n- **Dyu Art Cafe** — quiet courtyard, great wifi\n- **Third Wave** — loud but strong coffee\n- **Hatti Kaapi** — quick filter coffee break\n\nmy pick: Dyu, you'll actually focus there 🌿",
    at: iso(now - 0.2 * H),
    sources: [
      { title: "https://www.zomato.com/bangalore/dyu-art-cafe", url: "https://zomato.com" },
      { title: "https://lbb.in/bangalore/work-friendly-cafes", url: "https://lbb.in" },
    ],
  },
];

const TODOS: Todo[] = [
  { id: "1", text: "call amma", done: false, createdAt: iso(now), due: iso(now + 2 * H) },
  { id: "2", text: "stretch", done: false, createdAt: iso(now), due: iso(now + 4 * H), recurring: "daily" },
  { id: "3", text: "send invoice to the design studio", done: false, createdAt: iso(now), due: iso(now - 1 * H) },
  { id: "4", text: "buy milk", done: false, createdAt: iso(now) },
  { id: "5", text: "reply to Meera about the trip", done: false, createdAt: iso(now) },
  { id: "6", text: "water the real plants", done: true, createdAt: iso(now), completedAt: iso(now - H) },
];

function Frame({ label, w = 372, h = 310, children }: { label: string; w?: number; h?: number; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <figcaption style={{ font: "600 12px system-ui", color: "#888", letterSpacing: 0.3 }}>
        {label}
      </figcaption>
      <div style={{ width: w, height: h, position: "relative" }}>{children}</div>
    </figure>
  );
}

function Gallery() {
  const [todos, setTodos] = useState(TODOS);
  const [settings, setSettings] = useState({ ...defaultSettings(), userName: "Gayathri" });
  const facts = ["loves filter coffee", "works on a desktop companion app", "mom is called amma", "prefers mornings for deep work"];

  const [backdrop, setBackdrop] = useState<keyof typeof BACKDROPS>("wallpaper");
  return (
    <TooltipProvider delayDuration={350}>
    <div
      style={{
        minHeight: "100vh",
        padding: 32,
        boxSizing: "border-box",
        background: BACKDROPS[backdrop],
        display: "flex",
        flexWrap: "wrap",
        gap: 36,
        alignItems: "flex-start",
      }}
    >
      <ThemeSwitcher backdrop={backdrop} setBackdrop={setBackdrop} />
      <Frame label="Chat: conversation">
        <ChatPanel
          messages={MESSAGES}
          streamText={null}
          busy={false}
          connected
          userName="Gayathri"
          onConnectKey={noop}
          onSend={noop}
          onClose={noop}
          onBlobState={noop}
        />
      </Frame>
      <Frame label="Chat: thinking">
        <ChatPanel
          messages={MESSAGES.slice(0, 3)}
          streamText=""
          busy
          connected
          onConnectKey={noop}
          onSend={noop}
          onClose={noop}
          onBlobState={noop}
        />
      </Frame>
      <Frame label="Chat: empty">
        <ChatPanel
          messages={[]}
          streamText={null}
          busy={false}
          connected
          userName="Gayathri"
          onConnectKey={noop}
          onSend={noop}
          onClose={noop}
          onBlobState={noop}
        />
      </Frame>
      <Frame label="Chat: connect brain">
        <ChatPanel
          messages={[]}
          streamText={null}
          busy={false}
          connected={false}
          onConnectKey={noop}
          onSend={noop}
          onClose={noop}
          onBlobState={noop}
        />
      </Frame>
      <Frame label="Tasks">
        <TaskPanel
          todos={todos}
          growthStage={2}
          onAdd={(text, due, recurring) =>
            setTodos((t) => [
              { id: String(Math.random()), text, done: false, createdAt: iso(Date.now()), due: due ? due.toISOString() : null, recurring },
              ...t,
            ])
          }
          onActivity={noop}
          onMicPhase={noop}
          onEdit={(id, text, due) => setTodos((t) => t.map((x) => (x.id === id ? { ...x, text, due: due ? due.toISOString() : null } : x)))}
          onToggle={(id) =>
            setTodos((t) =>
              t.map((x) => (x.id === id ? { ...x, done: !x.done, completedAt: !x.done ? iso(Date.now()) : undefined } : x)),
            )
          }
          onDelete={(id) => setTodos((t) => t.filter((x) => x.id !== id))}
          onClose={noop}
        />
      </Frame>
      <Frame label="Tasks: empty">
        <TaskPanel
          todos={[]}
          growthStage={1}
          onAdd={noop}
          onActivity={noop}
          onMicPhase={noop}
          onEdit={noop}
          onToggle={noop}
          onDelete={noop}
          onClose={noop}
        />
      </Frame>
      <Frame label="Settings (full length)" h={1120}>
        <SettingsPanel
          settings={settings}
          facts={facts}
          week={{ key: "w", wellness: 7, taskBonus: 3, stagePeak: 5 }}
          growthStage={3}
          onPatch={(p) => setSettings((s) => ({ ...s, ...p }))}
          onDeleteFact={noop}
          onClearChat={async () => {}}
          onChangeKey={noop}
          onDeleteAll={noop}
          onClose={noop}
        />
      </Frame>
      <Frame label="Quick nav (panel open, chat active)" h={60}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <QuickNav
            items={[
              { icon: "chat", label: "chat", active: true, onClick: noop },
              { icon: "tasks", label: "tasks", onClick: noop },
              { icon: "settings", label: "settings", onClick: noop },
              { icon: "tuck", label: "nap", onClick: noop },
            ]}
          />
        </div>
      </Frame>
      <Frame label="Menu bar (click plant)" w={384} h={600}>
        <RadialMenu
          clipLeft={0}
          clipRight={0}
          onDismiss={noop}
          onSecret={noop}
          items={[
            { icon: "chat", label: "chat", onClick: noop },
            { icon: "tasks", label: "tasks", onClick: noop },
            { icon: "settings", label: "settings", onClick: noop },
            { icon: "tuck", label: "nap", onClick: noop },
          ]}
        />
        <PlantStub />
      </Frame>
      <Frame label="Reminder bubble" w={384} h={420}>
        <ReminderBubble
          fired={{ id: "1", text: "call amma", timeLabel: "6:00 PM", missed: false }}
          onDone={noop}
          onSnooze={noop}
        />
        <PlantStub />
      </Frame>
      <Frame label="Reminder bubble: missed" w={384} h={420}>
        <ReminderBubble
          fired={{ id: "1", text: "send invoice to the design studio", timeLabel: "2:00 PM", missed: true }}
          onDone={noop}
          onSnooze={noop}
        />
        <PlantStub />
      </Frame>
      <Frame label="Wellness nudge" w={384} h={420}>
        <NudgeBubble
          text="you've been at it a while. stretch with me?"
          actions={[
            { label: "Did it", primary: true, onClick: noop },
            { label: "Not now", onClick: noop },
          ]}
        />
        <PlantStub />
      </Frame>
      <Frame label="Joke nudge" w={384} h={420}>
        <NudgeBubble
          text="what do you call a plant that's always on its phone?"
          actions={[
            { label: "What?", primary: true, onClick: noop },
            { label: "Not now", onClick: noop },
          ]}
        />
        <PlantStub />
      </Frame>
    </div>
    </TooltipProvider>
  );
}

// What's "behind" the companion: wallpaper, a white app (Notion / Chrome /
// Docs) or a dark app (VS Code / Figma dark), to check panels stay visible.
const BACKDROPS = {
  wallpaper:
    "radial-gradient(1200px 700px at 15% 10%, #7aa6c9 0%, transparent 60%), radial-gradient(900px 600px at 85% 80%, #c98f7a 0%, transparent 60%), linear-gradient(135deg, #3d5a73, #6b5a7a)",
  "white app": "#ffffff",
  "grey app": "#f3f3f3",
  "dark app": "#1e1e1e",
} as const;

function ThemeSwitcher({ backdrop, setBackdrop }: { backdrop: keyof typeof BACKDROPS; setBackdrop: (b: keyof typeof BACKDROPS) => void }) {
  const [dark, setDark] = useState(false);
  const pill = (on: boolean) => `rounded-full px-3 py-1 ${on ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"}`;
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-black/60 p-2 text-sm text-white">
      <span className="px-2 font-semibold">Behind</span>
      {(Object.keys(BACKDROPS) as (keyof typeof BACKDROPS)[]).map((k) => (
        <button key={k} onClick={() => setBackdrop(k)} className={pill(backdrop === k)}>
          {k}
        </button>
      ))}
      <span className="ml-4 px-2 font-semibold">Panels</span>
      {[false, true].map((d) => (
        <button
          key={String(d)}
          onClick={() => {
            setDark(d);
            document.documentElement.classList.toggle("dark", d);
          }}
          className={pill(dark === d)}
        >
          {d ? "Dark" : "Light"}
        </button>
      ))}
    </div>
  );
}

function PlantStub() {
  return (
    <img
      src="./character/growth2/f-001.png"
      alt=""
      style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 204, height: 240, objectFit: "contain", objectPosition: "bottom center" }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Gallery />);
