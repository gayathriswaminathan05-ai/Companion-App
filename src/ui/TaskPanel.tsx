import { useMemo, useState } from "react";
import type { Todo } from "../store";
import { parseReminder, parseWhen, formatDue } from "../reminders";
import { panel, smallBtn } from "./theme";
import MicButton from "./MicButton";

const STAGE_EMOJI: Record<string, string> = {
  bud: "🌰",
  leaf: "🌱",
  leaves: "🌿",
  bloom: "🌸",
};

// One list. Any task may carry a time — those also ring as reminders.
export default function TaskPanel({
  todos,
  sproutStage,
  onAdd,
  onActivity,
  onMicPhase,
  onEdit,
  onToggle,
  onDelete,
  onClose,
}: {
  todos: Todo[];
  sproutStage: string;
  onAdd: (text: string, due?: Date, recurring?: "daily") => void;
  onActivity: () => void;
  onMicPhase: (recording: boolean) => void;
  onEdit: (id: string, text: string, due: Date | null) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseReminder(text), [text]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editWhen, setEditWhen] = useState("");
  const editDue = useMemo(() => (editWhen.trim() ? parseWhen(editWhen) : null), [editWhen]);

  const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
  const timed = todos
    .filter((t) => !t.done && t.due)
    .sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime());
  const plain = todos.filter((t) => !t.done && !t.due);
  const doneToday = todos.filter((t) => t.done && isToday(t.completedAt));
  const doneOlder = todos.filter((t) => t.done && !isToday(t.completedAt));

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (parsed) onAdd(parsed.title, parsed.due, parsed.recurring);
    else onAdd(trimmed);
    setText("");
  };

  const submitPlain = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(parsed ? parsed.title : trimmed);
    setText("");
  };

  const startEdit = (t: Todo) => {
    setEditingId(t.id);
    setEditText(t.text);
    setEditWhen(t.due ? formatDue(new Date(t.due)) : "");
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    if (editWhen.trim() && !editDue) return; // wrote a time but we can't read it
    onEdit(editingId, editText.trim(), editWhen.trim() ? editDue : null);
    setEditingId(null);
  };

  const rowProps = { onToggle, onDelete, startEdit };

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          today {STAGE_EMOJI[sproutStage] ?? "🌱"}
          <span style={{ fontWeight: 400, color: "#a08e70", marginLeft: 6, fontSize: 11 }}>
            {doneToday.length === 0 ? "let's grow the sprout" : `${doneToday.length} done — sprout is happy`}
          </span>
        </span>
        <button style={{ ...smallBtn, padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); onActivity(); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="buy milk · call amma at 6pm · stretch daily at 11"
          style={{
            flex: 1,
            fontSize: 12,
            padding: "7px 9px",
            borderRadius: 8,
            border: "1px solid #d8c9ac",
            outline: "none",
            fontFamily: "inherit",
            background: "#fffdf7",
            color: "#5a4a3a",
          }}
        />
        <MicButton current={text} onTranscript={(t) => { setText(t); onActivity(); }} onSpeaking={onMicPhase} />
        <button style={smallBtn} onClick={submit}>add</button>
      </div>

      <div style={{ minHeight: parsed ? 26 : 6, margin: "5px 0" }}>
        {parsed && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                background: "#eaf3df",
                border: "1px solid #c9dfb2",
                color: "#5a7a42",
                borderRadius: 8,
                padding: "3px 8px",
              }}
            >
              ⏰ {formatDue(parsed.due)}
              {parsed.recurring ? " · every day" : ""} — {parsed.title}
            </span>
            <button
              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 10.5, color: "#b3a284", textDecoration: "underline" }}
              onClick={submitPlain}
            >
              no, just add it
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {timed.length + plain.length + doneToday.length + doneOlder.length === 0 && (
          <div style={{ fontSize: 12, color: "#a08e70", textAlign: "center", marginTop: 20 }}>
            nothing here yet — one small thing at a time 🌱
          </div>
        )}
        {timed.length + plain.length === 0 && doneToday.length > 0 && (
          <div style={{ fontSize: 12, color: "#8fae6e", textAlign: "center", margin: "8px 0" }}>
            all done for today — I'm so proud of us 🌸
          </div>
        )}

        {[...timed, ...plain].map((t) =>
          editingId === t.id ? (
            <EditRow
              key={t.id}
              editText={editText}
              setEditText={setEditText}
              editWhen={editWhen}
              setEditWhen={setEditWhen}
              editDue={editDue}
              onSave={saveEdit}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Row key={t.id} todo={t} {...rowProps} />
          ),
        )}

        {doneToday.length > 0 && (
          <div style={{ fontSize: 10, color: "#b3a284", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            done today ✨
          </div>
        )}
        {doneToday.map((t) => (
          <Row key={t.id} todo={t} {...rowProps} />
        ))}
        {doneOlder.length > 0 && (
          <div style={{ fontSize: 10, color: "#c5b696", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            earlier
          </div>
        )}
        {doneOlder.map((t) => (
          <Row key={t.id} todo={t} {...rowProps} />
        ))}
      </div>
    </div>
  );
}

function EditRow({
  editText,
  setEditText,
  editWhen,
  setEditWhen,
  editDue,
  onSave,
  onCancel,
}: {
  editText: string;
  setEditText: (s: string) => void;
  editWhen: string;
  setEditWhen: (s: string) => void;
  editDue: Date | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const whenOk = !editWhen.trim() || !!editDue;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        padding: 7,
        borderRadius: 8,
        background: "#fdf6e8",
        border: "1px solid #e0cfa8",
      }}
    >
      <input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        autoFocus
        style={{
          fontSize: 12,
          padding: "5px 7px",
          borderRadius: 6,
          border: "1px solid #d8c9ac",
          outline: "none",
          fontFamily: "inherit",
          background: "#fffdf7",
          color: "#5a4a3a",
        }}
      />
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <input
          value={editWhen}
          onChange={(e) => setEditWhen(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          placeholder="time (optional) — e.g. tomorrow 8am"
          style={{
            flex: 1,
            fontSize: 11.5,
            padding: "5px 7px",
            borderRadius: 6,
            border: `1px solid ${whenOk ? "#c9dfb2" : "#e8b8b0"}`,
            outline: "none",
            fontFamily: "inherit",
            background: "#fffdf7",
            color: "#5a4a3a",
          }}
        />
        {editDue && (
          <span style={{ fontSize: 10, color: "#5a7a42", whiteSpace: "nowrap" }}>
            → {formatDue(editDue)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <button
          style={{ ...smallBtn, flex: 1, borderColor: "#c9dfb2", background: "#eaf3df", opacity: editText.trim() && whenOk ? 1 : 0.5 }}
          onClick={onSave}
        >
          save ✓
        </button>
        <button style={{ ...smallBtn, flex: 1 }} onClick={onCancel}>cancel</button>
      </div>
    </div>
  );
}

function Row({
  todo,
  onToggle,
  onDelete,
  startEdit,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  startEdit: (t: Todo) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 10,
        background: todo.done ? "#f4eddd" : "#fffdf7",
        border: "1px solid #eee2c8",
      }}
    >
      <button
        onClick={() => onToggle(todo.id)}
        aria-label={todo.done ? "mark not done" : "mark done"}
        className={todo.done ? "check done" : "check"}
        style={{
          width: 20,
          height: 20,
          minWidth: 20,
          borderRadius: "50%",
          border: todo.done ? "1.5px solid #8fae6e" : "1.5px solid #d8c9ac",
          background: todo.done ? "#93C46F" : "#fffdf7",
          color: "#fff",
          fontSize: 12,
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {todo.done ? "✓" : ""}
      </button>
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          textDecoration: todo.done ? "line-through" : "none",
          color: todo.done ? "#b3a284" : "#5a4a3a",
          wordBreak: "break-word",
        }}
      >
        {todo.text}
        {todo.due && !todo.done && (
          <span
            style={{
              fontSize: 10,
              background: "#eaf3df",
              border: "1px solid #c9dfb2",
              color: "#5a7a42",
              borderRadius: 6,
              padding: "1px 5px",
              marginLeft: 6,
              whiteSpace: "nowrap",
            }}
          >
            ⏰ {formatDue(new Date(todo.due))}
            {todo.recurring ? " ↻" : ""}
          </span>
        )}
      </span>
      {!todo.done && (
        <button
          onClick={() => startEdit(todo)}
          title="edit"
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11 }}
        >
          ✏️
        </button>
      )}
      <button
        onClick={() => onDelete(todo.id)}
        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c9b89a", fontSize: 12 }}
      >
        ✕
      </button>
      <style>{`
        .check { transition: transform 0.12s ease-out, background 0.15s; }
        .check:active { transform: scale(0.85); }
        .check.done { animation: checkpop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes checkpop {
          0% { transform: scale(0.6); }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
