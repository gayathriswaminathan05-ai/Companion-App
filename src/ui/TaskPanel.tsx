import { useMemo, useState } from "react";
import type { Todo } from "../store";
import { parseReminder, parseWhen, formatDue } from "../reminders";
import { COLORS, panel, smallBtn, primaryBtn, ghostClose, inputBar, field, chip } from "./theme";
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
  const [micKey, setMicKey] = useState(0);
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
    setMicKey((k) => k + 1);
  };

  const submitPlain = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(parsed ? parsed.title : trimmed);
    setText("");
    setMicKey((k) => k + 1);
  };

  const startEdit = (t: Todo) => {
    setEditingId(t.id);
    setEditText(t.text);
    setEditWhen(t.due ? formatDue(new Date(t.due)) : "");
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    if (editWhen.trim() && !editDue) return;
    onEdit(editingId, editText.trim(), editWhen.trim() ? editDue : null);
    setEditingId(null);
  };

  const rowProps = { onToggle, onDelete, startEdit };
  const canAdd = Boolean(text.trim());

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 12, gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          today {STAGE_EMOJI[sproutStage] ?? "🌱"}
          <span style={{ fontWeight: 400, color: COLORS.textSoft, marginLeft: 6, fontSize: 11 }}>
            {doneToday.length === 0 ? "let's grow the sprout" : `${doneToday.length} done — sprout is happy`}
          </span>
        </span>
        <button style={ghostClose} onClick={onClose} title="close">✕</button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ ...inputBar, flex: 1, padding: "6px 10px", minWidth: 0 }}>
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); onActivity(); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="buy milk · call amma at 6pm"
            style={{
              flex: 1,
              fontSize: 12,
              padding: "4px 0",
              border: "none",
              outline: "none",
              fontFamily: "inherit",
              background: "transparent",
              color: COLORS.text,
              minWidth: 0,
            }}
          />
          <MicButton key={micKey} bare current={text} onTranscript={(t) => { setText(t); onActivity(); }} onSpeaking={onMicPhase} />
        </div>
        <button
          style={{
            ...smallBtn,
            ...(canAdd ? primaryBtn : {}),
            opacity: canAdd ? 1 : 0.55,
            alignSelf: "stretch",
          }}
          onClick={submit}
        >
          add
        </button>
      </div>

      <div style={{ minHeight: parsed ? 26 : 0 }}>
        {parsed && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={chip}>
              ⏰ {formatDue(parsed.due)}
              {parsed.recurring ? " · every day" : ""} — {parsed.title}
            </span>
            <button
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 10.5,
                color: COLORS.textSoft,
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
              onClick={submitPlain}
            >
              no, just add it
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
        {timed.length + plain.length + doneToday.length + doneOlder.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.placeholder, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
            nothing here yet — one small thing at a time 🌱
          </div>
        )}
        {timed.length + plain.length === 0 && doneToday.length > 0 && (
          <div style={{ fontSize: 12, color: COLORS.accent, textAlign: "center", margin: "8px 0" }}>
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
          <div style={{ fontSize: 10, color: COLORS.textSoft, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            done today ✨
          </div>
        )}
        {doneToday.map((t) => (
          <Row key={t.id} todo={t} {...rowProps} />
        ))}
        {doneOlder.length > 0 && (
          <div style={{ fontSize: 10, color: COLORS.placeholder, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
        gap: 6,
        padding: 10,
        borderRadius: 12,
        background: COLORS.accentSoft,
        border: "1px solid rgba(106, 83, 231, 0.12)",
      }}
    >
      <input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        autoFocus
        style={{ ...field, width: "100%", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <input
          value={editWhen}
          onChange={(e) => setEditWhen(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          placeholder="time (optional) — e.g. tomorrow 8am"
          style={{
            ...field,
            flex: 1,
            borderColor: whenOk ? "rgba(106, 83, 231, 0.2)" : COLORS.dangerBorder,
          }}
        />
        {editDue && (
          <span style={{ fontSize: 10, color: COLORS.accent, whiteSpace: "nowrap" }}>
            → {formatDue(editDue)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <button
          style={{
            ...primaryBtn,
            flex: 1,
            opacity: editText.trim() && whenOk ? 1 : 0.5,
          }}
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
        padding: "8px 10px",
        borderRadius: 12,
        background: todo.done ? "rgba(255,255,255,0.45)" : COLORS.inputBg,
        border: "1px solid rgba(32, 29, 47, 0.06)",
        boxShadow: todo.done ? "none" : "0 1px 2px rgba(12, 12, 13, 0.05)",
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
          border: todo.done ? `1.5px solid ${COLORS.accent}` : "1.5px solid rgba(32, 29, 47, 0.18)",
          background: todo.done ? COLORS.accent : "#fff",
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
          color: todo.done ? COLORS.textSoft : COLORS.text,
          wordBreak: "break-word",
        }}
      >
        {todo.text}
        {todo.due && !todo.done && (
          <span style={{ ...chip, marginLeft: 6, whiteSpace: "nowrap", fontSize: 10, padding: "1px 5px" }}>
            ⏰ {formatDue(new Date(todo.due))}
            {todo.recurring ? " ↻" : ""}
          </span>
        )}
      </span>
      {!todo.done && (
        <button
          onClick={() => startEdit(todo)}
          title="edit"
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, opacity: 0.7 }}
        >
          ✏️
        </button>
      )}
      <button
        onClick={() => onDelete(todo.id)}
        style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.placeholder, fontSize: 12 }}
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
