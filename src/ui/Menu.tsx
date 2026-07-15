import { panel } from "./theme";

export type PanelName = "todos" | "chat";

const itemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "7px 10px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 11,
  color: "#5a4a3a",
};

export default function Menu({
  onOpen,
  onHide,
  onSoon,
}: {
  onOpen: (p: PanelName) => void;
  onHide: () => void;
  onSoon: (what: string) => void;
}) {
  return (
    <div
      style={{
        ...panel,
        display: "flex",
        gap: 2,
        padding: "4px 6px",
        alignItems: "center",
      }}
    >
      <button style={itemStyle} onClick={() => onOpen("chat")}>
        <span style={{ fontSize: 17 }}>💬</span>chat
      </button>
      <button style={itemStyle} onClick={() => onOpen("todos")}>
        <span style={{ fontSize: 17 }}>✅</span>to-dos
      </button>
      <button style={itemStyle} onClick={() => onSoon("Reminders arrive on Day 4!")}>
        <span style={{ fontSize: 17 }}>⏰</span>reminders
      </button>
      <button style={itemStyle} onClick={() => onSoon("Settings arrive on Day 6!")}>
        <span style={{ fontSize: 17 }}>⚙️</span>settings
      </button>
      <button style={itemStyle} onClick={onHide}>
        <span style={{ fontSize: 17 }}>💤</span>tuck away
      </button>
    </div>
  );
}
