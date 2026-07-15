import { useEffect, useRef, useState } from "react";
import { panel, smallBtn } from "./theme";
import MicButton from "./MicButton";
import type { ChatMsg } from "../brain";

export default function ChatPanel({
  messages,
  streamText,
  busy,
  connected,
  onConnectKey,
  onSend,
  onClose,
  onBlobState,
}: {
  messages: ChatMsg[];
  streamText: string | null; // partial assistant reply while streaming
  busy: boolean;
  connected: boolean;
  onConnectKey: (key: string) => void;
  onSend: (text: string) => void;
  onClose: () => void;
  onBlobState: (s: "listening" | "idle") => void;
}) {
  const [text, setText] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [micKey, setMicKey] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
    setMicKey((k) => k + 1); // cancels any in-flight transcription cleanly
  };

  if (!connected) {
    return (
      <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>connect my brain 🔑</span>
          <button style={{ ...smallBtn, padding: "2px 8px" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: "#5a4a3a" }}>
          to really talk with you, I need a Claude API key:
          <ol style={{ margin: "6px 0", paddingLeft: 18 }}>
            <li>go to <b>platform.claude.com</b></li>
            <li>sign in → <b>API Keys</b> → <b>Create key</b></li>
            <li>copy it and paste below</li>
          </ol>
          it's stored only on this computer, never anywhere else 🤍
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="sk-ant-…"
            type="password"
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
          <button
            style={{ ...smallBtn, borderColor: "#c9dfb2", background: "#eaf3df" }}
            onClick={() => keyDraft.trim() && onConnectKey(keyDraft.trim())}
          >
            connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>chat 💬</span>
        <button style={{ ...smallBtn, padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>

      <div ref={scroller} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
        {messages.length === 0 && streamText === null && (
          <div style={{ fontSize: 12, color: "#a08e70", textAlign: "center", marginTop: 18 }}>
            tell me anything — how your day's going, some gossip, a question… 🌱
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} mine={m.role === "user"} text={m.text} sources={m.sources} />
        ))}
        {streamText !== null && <Bubble mine={false} text={streamText || "…"} />}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 2,
            border: "1px solid #d8c9ac",
            borderRadius: 8,
            background: "#fffdf7",
            padding: "2px 4px 2px 8px",
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => onBlobState("listening")}
            onBlur={() => onBlobState("idle")}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={busy ? "thinking…" : "say something… (hold 🎤 to talk)"}
            style={{
              flex: 1,
              fontSize: 12,
              padding: "5px 0",
              border: "none",
              outline: "none",
              fontFamily: "inherit",
              background: "transparent",
              color: "#5a4a3a",
            }}
          />
          <MicButton key={micKey} bare current={text} onTranscript={setText} />
          <button
            onClick={send}
            disabled={!text.trim() || busy}
            title="send"
            style={{
              width: 26,
              height: 26,
              minWidth: 26,
              borderRadius: "50%",
              border: "none",
              background: text.trim() && !busy ? "#5a4a3a" : "#d8cbb4",
              color: "#fff8ec",
              fontSize: 14,
              fontWeight: 700,
              cursor: text.trim() && !busy ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "background 0.15s",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

// Markdown-lite: **bold**, [label](url), bare URLs, "- " bullets → rich nodes.
function renderInline(line: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) nodes.push(line.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<b key={`${keyBase}-${i++}`}>{tok.slice(2, -2)}</b>);
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const url = tok.slice(tok.indexOf("(") + 1, -1);
      nodes.push(
        <a
          key={`${keyBase}-${i++}`}
          onClick={(e) => {
            e.preventDefault();
            window.companion.openLink(url);
          }}
          href={url}
          style={{ color: "#4a6a8a", textDecoration: "underline", cursor: "pointer", wordBreak: "break-all" }}
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(
        <a
          key={`${keyBase}-${i++}`}
          onClick={(e) => {
            e.preventDefault();
            window.companion.openLink(tok);
          }}
          href={tok}
          style={{ color: "#4a6a8a", textDecoration: "underline", cursor: "pointer", wordBreak: "break-all" }}
        >
          {shortLabel(tok)}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

function renderRich(text: string): React.ReactNode[] {
  return text.split("\n").map((line, li) => {
    const bullet = line.startsWith("- ");
    const content = renderInline(bullet ? line.slice(2) : line, `l${li}`);
    return (
      <div key={li} style={bullet ? { paddingLeft: 12, textIndent: -8, margin: "1px 0" } : undefined}>
        {bullet ? <>• {content}</> : content.length ? content : " "}
      </div>
    );
  });
}

function shortLabel(title: string): string {
  let t = title;
  for (const prefix of ["https://", "http://"]) {
    if (t.startsWith(prefix)) t = t.slice(prefix.length);
  }
  if (t.startsWith("www.")) t = t.slice(4);
  return t.slice(0, 40);
}

function Bubble({ mine, text, sources }: { mine: boolean; text: string; sources?: { title: string; url: string }[] }) {
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "84%",
        fontSize: 12.5,
        lineHeight: 1.45,
        padding: "6px 10px",
        borderRadius: 12,
        background: mine ? "#ffe9c2" : "#f2f7ea",
        border: "1px solid " + (mine ? "#f0d9a8" : "#dbe8cc"),
        color: "#5a4a3a",
        wordBreak: "break-word",
      }}
    >
      {renderRich(text)}
      {sources && sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {sources.map((s) => (
            <button
              key={s.url}
              onClick={() => window.companion.openLink(s.url)}
              title={s.url}
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 8,
                border: "1px solid #c9d8e8",
                background: "#eef4fa",
                color: "#4a6a8a",
                cursor: "pointer",
                fontFamily: "inherit",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              🔗 {shortLabel(s.title)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
