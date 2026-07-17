import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MicButton from "./MicButton";
import type { ChatMsg } from "../brain";
import sendIcon from "./assets/chat-send.svg";

// Figma chat window (node 2:107) — frosted glass + lavender accents
const COLORS = {
  panelBg: "rgba(243, 243, 243, 0.94)",
  panelBorder: "#ffffff",
  bubbleUser: "#e7e3ff",
  bubbleBot: "#ffffff",
  text: "#201d2f",
  textUser: "#190681",
  placeholder: "#9e9e9e",
  inputBg: "#ffffff",
  accent: "#6A53E7",
  accentSoft: "#f5f3ff",
  sendIdle: "rgba(106, 83, 231, 0.22)",
};

const INPUT_MAX_H = 120; // grows upward until this, then scrolls

const shell: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  padding: 12,
  gap: 12,
  background: COLORS.panelBg,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 20,
  boxShadow: "0 4px 18px rgba(32, 29, 47, 0.12)",
  fontFamily: '"Noto Sans", system-ui, -apple-system, sans-serif',
  color: COLORS.text,
  backdropFilter: "blur(40px) saturate(1.4)",
  WebkitBackdropFilter: "blur(40px) saturate(1.4)",
  boxSizing: "border-box",
  position: "relative",
};

const inputBar: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 8,
  padding: 12,
  background: COLORS.inputBg,
  borderRadius: 10,
  boxShadow:
    "0 1px 2px rgba(12, 12, 13, 0.1), 0 1px 2px rgba(12, 12, 13, 0.05)",
  flexShrink: 0,
};

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
  streamText: string | null;
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
  const [recording, setRecording] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = Boolean(text.trim());
  const active = (hasContent || recording) && !busy;
  const canSend = hasContent && !busy;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  // Auto-grow textarea upward (like Cursor composer).
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, INPUT_MAX_H);
    el.style.height = `${next}px`;
  }, [text]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
    setMicKey((k) => k + 1);
  };

  if (!connected) {
    return (
      <div style={shell}>
        <CloseBtn onClose={onClose} />
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
          connect my brain
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: COLORS.text, opacity: 0.7, flex: 1 }}>
          to really talk with you, I need a Claude API key:
          <ol style={{ margin: "6px 0", paddingLeft: 18 }}>
            <li>go to <b>platform.claude.com</b></li>
            <li>sign in → <b>API Keys</b> → <b>Create key</b></li>
            <li>copy it and paste below</li>
          </ol>
          it's stored only on this computer, never anywhere else
        </div>
        <div style={{ ...inputBar, gap: 8, alignItems: "center" }}>
          <input
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="sk-ant-…"
            type="password"
            style={{
              flex: 1,
              fontSize: 12,
              border: "none",
              outline: "none",
              fontFamily: "inherit",
              background: "transparent",
              color: COLORS.text,
              minWidth: 0,
            }}
          />
          <button
            onClick={() => keyDraft.trim() && onConnectKey(keyDraft.trim())}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "6px 10px",
              background: COLORS.accentSoft,
              color: COLORS.accent,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <CloseBtn onClose={onClose} />

      <div
        ref={scroller}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingRight: 2,
          minHeight: 0,
        }}
      >
        {messages.length === 0 && streamText === null && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.placeholder,
              textAlign: "center",
              marginTop: 18,
              lineHeight: 1.5,
            }}
          >
            tell me anything — how your day's going, some gossip, a question…
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} mine={m.role === "user"} text={m.text} sources={m.sources} />
        ))}
        {streamText !== null && <Bubble mine={false} text={streamText || "…"} />}
      </div>

      <div style={inputBar}>
        <textarea
          ref={taRef}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onBlobState("listening")}
          onBlur={() => onBlobState("idle")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={busy ? "thinking…" : "Let’s chat..."}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: "18px",
            padding: 0,
            border: "none",
            outline: "none",
            resize: "none",
            overflowY: "auto",
            fontFamily: "inherit",
            background: "transparent",
            color: COLORS.text,
            minWidth: 0,
            maxHeight: INPUT_MAX_H,
            alignSelf: "center",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            paddingBottom: 0,
            alignSelf: "flex-end",
          }}
        >
          <MicButton
            key={micKey}
            variant="chat"
            current={text}
            onTranscript={setText}
            onRecordingChange={setRecording}
          />
          <button
            onClick={send}
            disabled={!canSend}
            title="send"
            style={{
              width: 22,
              height: 22,
              minWidth: 22,
              borderRadius: 22,
              border: "none",
              background: active ? COLORS.accent : COLORS.sendIdle,
              cursor: canSend ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "background 0.2s ease, transform 0.15s ease",
              transform: active ? "scale(1)" : "scale(0.96)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <img
              src={sendIcon}
              alt=""
              width={12}
              height={12}
              style={{ display: "block", pointerEvents: "none" }}
              draggable={false}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      title="close"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        border: "none",
        borderRadius: 11,
        background: "rgba(255,255,255,0.55)",
        color: COLORS.placeholder,
        fontSize: 12,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        zIndex: 2,
        fontFamily: "inherit",
      }}
    >
      ✕
    </button>
  );
}

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
          style={{ color: COLORS.accent, textDecoration: "underline", cursor: "pointer", wordBreak: "break-all" }}
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
          style={{ color: COLORS.accent, textDecoration: "underline", cursor: "pointer", wordBreak: "break-all" }}
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
        alignSelf: "stretch",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: "16.7px",
        padding: 12,
        borderRadius: 10,
        background: mine ? COLORS.bubbleUser : COLORS.bubbleBot,
        color: COLORS.text,
        opacity: 0.9,
        wordBreak: "break-word",
        boxShadow: mine ? undefined : "0 1px 2px rgba(12, 12, 13, 0.06)",
      }}
    >
      <div style={{ opacity: 0.78 }}>{renderRich(text)}</div>
      {sources && sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {sources.map((s) => (
            <button
              key={s.url}
              onClick={() => window.companion.openLink(s.url)}
              title={s.url}
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 8,
                border: "none",
                background: COLORS.accentSoft,
                color: COLORS.accent,
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
