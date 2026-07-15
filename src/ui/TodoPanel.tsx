import { useState } from "react";
import type { Todo } from "../store";
import { panel, smallBtn } from "./theme";

export default function TodoPanel({
  todos,
  onAdd,
  onToggle,
  onDelete,
  onClose,
}: {
  todos: Todo[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
  };

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>our to-dos 📝</span>
        <button style={{ ...smallBtn, padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="add something…"
          style={{
            flex: 1,
            fontSize: 12,
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #d8c9ac",
            outline: "none",
            fontFamily: "inherit",
            background: "#fffdf7",
            color: "#5a4a3a",
          }}
        />
        <button style={smallBtn} onClick={submit}>add</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {open.length === 0 && done.length === 0 && (
          <div style={{ fontSize: 12, color: "#a08e70", textAlign: "center", marginTop: 20 }}>
            nothing here yet — tell me what's on your plate 🌱
          </div>
        )}
        {open.map((t) => (
          <Row key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} />
        ))}
        {done.length > 0 && (
          <div style={{ fontSize: 10, color: "#b3a284", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            done today ✨
          </div>
        )}
        {done.map((t) => (
          <Row key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function Row({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 7px",
        borderRadius: 8,
        background: todo.done ? "#f4eddd" : "#fffdf7",
        border: "1px solid #eee2c8",
      }}
    >
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} style={{ cursor: "pointer" }} />
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
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c9b89a", fontSize: 12 }}
      >
        ✕
      </button>
    </div>
  );
}
