import { useEffect, useRef, useState } from "react";
import Blob from "./character/Blob";
import DebugMenu from "./DebugMenu";
import Menu, { PanelName } from "./ui/Menu";
import TodoPanel from "./ui/TodoPanel";
import ChatPanel from "./ui/ChatPanel";
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
  const [open, setOpen] = useState<"none" | "menu" | PanelName>("none");
  const [toast, setToast] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const mouseDownAt = useRef<{ x: number; y: number } | null>(null);

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

  const addTodo = (text: string) => {
    update((d) => {
      d.todos.unshift({ id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() });
      return d;
    });
    set("writing");
  };

  const toggleTodo = (id: string) => {
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

  const deleteTodo = (id: string) => {
    update((d) => {
      d.todos = d.todos.filter((x) => x.id !== id);
      return d;
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const sproutStage = sproutStageFor(data.sprout.points);
  const panelOpen = open === "todos" || open === "chat";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "none" }}>
      {panelOpen && (
        <div {...hoverable} style={{ position: "absolute", top: 6, left: 6, right: 6, height: 280, pointerEvents: "auto" }}>
          {open === "todos" && (
            <TodoPanel
              todos={data.todos}
              onAdd={addTodo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onClose={() => setOpen("none")}
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
        <div
          {...hoverable}
          style={{ position: "absolute", bottom: 208, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto" }}
        >
          <Menu
            onOpen={(p) => setOpen(p)}
            onHide={() => {
              setOpen("none");
              window.companion?.hide();
            }}
            onSoon={(msg) => {
              showToast(msg);
              setOpen("none");
            }}
          />
        </div>
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
        onMouseUp={() => {
          if (!dragging && mouseDownAt.current) {
            setOpen((o) => (o === "none" ? "menu" : "none"));
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
        <Blob state={state} sproutStage={sproutStage} />
      </div>

      {debugOpen && (
        <div style={{ position: "absolute", inset: 6, pointerEvents: "auto" }}>
          <DebugMenu
            current={state}
            sprout={sproutStage}
            onState={set}
            onSprout={() => showToast("sprout now grows with your day 🌱")}
            onClose={() => setDebugOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
