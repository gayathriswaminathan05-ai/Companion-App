import { useEffect, useRef, useState } from "react";
import { panel, smallBtn } from "./theme";
import MicButton from "./MicButton";

interface Msg {
  from: "you" | "blob";
  text: string;
}

// Placeholder personality until the real brain arrives on Day 8.
const CANNED = [
  "I'm still growing my brain — on Day 8 I'll really understand you! 🌱",
  "*happy wiggle* I love when you talk to me",
  "soon I'll actually remember everything you tell me, promise 🤍",
  "noted! (well… pretend-noted. real notes coming soon)",
  "you're my favorite person to sit next to",
];

export default function ChatPanel({
  onClose,
  onBlobState,
}: {
  onClose: () => void;
  onBlobState: (s: "listening" | "thinking" | "idle") => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "blob", text: "hi! I can't really think yet, but I love company 🌱" },
  ]);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMsgs((m) => [...m, { from: "you", text: trimmed }]);
    setText("");
    onBlobState("thinking");
    const reply = CANNED[Math.floor(Math.random() * CANNED.length)];
    setTimeout(() => {
      setMsgs((m) => [...m, { from: "blob", text: reply }]);
      onBlobState("idle");
    }, 900 + Math.random() * 800);
  };

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>chat 💬</span>
        <button style={{ ...smallBtn, padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>

      <div ref={scroller} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.from === "you" ? "flex-end" : "flex-start",
              maxWidth: "82%",
              fontSize: 12.5,
              lineHeight: 1.45,
              padding: "6px 10px",
              borderRadius: 12,
              background: m.from === "you" ? "#ffe9c2" : "#f2f7ea",
              border: "1px solid " + (m.from === "you" ? "#f0d9a8" : "#dbe8cc"),
              color: "#5a4a3a",
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onBlobState("listening")}
          onBlur={() => onBlobState("idle")}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="say something…"
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
        <MicButton current={text} onTranscript={setText} />
        <button style={smallBtn} onClick={send}>send</button>
      </div>
    </div>
  );
}
