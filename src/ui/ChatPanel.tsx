import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpIcon, LinkSimpleIcon, LockSimpleIcon, SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import MicButton from "./MicButton";
import type { ChatMsg } from "../brain";
import { Panel, PanelHeader } from "@/components/panel";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

// Chat: Blob speaks in plain text, the user's words sit in quiet grey bubbles
// on the right (Pi / Claude pattern), day dividers between sessions, and one
// composer with hold-to-talk mic + send.

const INPUT_MAX_H = 120; // grows upward until this, then scrolls

const SUGGESTIONS = ["I need to vent", "Help me plan today", "Tell me some gossip"];

export default function ChatPanel({
  messages,
  streamText,
  busy,
  connected,
  companionName = "Blob",
  userName = "",
  voiceChat,
  onToggleVoiceChat,
  onConnectKey,
  onSend,
  onClose,
  onBlobState,
}: {
  messages: ChatMsg[];
  streamText: string | null;
  busy: boolean;
  connected: boolean;
  companionName?: string;
  userName?: string;
  /** Replies are read aloud; header shows a mute / unmute button. */
  voiceChat?: boolean;
  onToggleVoiceChat?: () => void;
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

  const canSend = Boolean(text.trim()) && !busy;

  // Jump to the newest message on open; glide for messages that arrive after.
  const scrolledOnce = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: scrolledOnce.current ? "smooth" : "auto" });
    scrolledOnce.current = true;
  }, [messages, streamText]);

  // Auto-grow textarea upward (like Cursor composer).
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_H)}px`;
  }, [text]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
    setMicKey((k) => k + 1);
  };

  const name = companionName.trim() || "Blob";

  if (!connected) {
    const key = keyDraft.trim();
    return (
      <Panel>
        <PanelHeader title={`Connect ${name}'s brain`} onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          <p className="text-muted-foreground">To really talk with you, I need a Claude API key. It takes a minute.</p>
          <ol className="flex flex-col gap-2.5">
            {[
              <>
                Open{" "}
                <a
                  href="https://platform.claude.com"
                  onClick={(e) => {
                    e.preventDefault();
                    window.companion.openLink("https://platform.claude.com");
                  }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  platform.claude.com
                </a>{" "}
                and sign in
              </>,
              <>
                Go to <span className="font-medium">API Keys</span>, then <span className="font-medium">Create key</span>
              </>,
              <>Copy it and paste it below</>,
            ].map((step, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-auto flex flex-col gap-2">
            <InputGroup className="h-9 bg-card">
              <InputGroupAddon>
                <LockSimpleIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && key && onConnectKey(key)}
                placeholder="sk-ant-..."
                type="password"
                autoComplete="off"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="default" size="xs" disabled={!key} onClick={() => key && onConnectKey(key)}>
                  Connect
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="text-center text-xs text-muted-foreground">Stored only on this computer, never anywhere else.</p>
          </div>
        </div>
      </Panel>
    );
  }

  const empty = messages.length === 0 && streamText === null;

  return (
    <Panel>
      <PanelHeader title={name} onClose={onClose}>
        {busy && <span className="text-xs text-muted-foreground">thinking...</span>}
        {onToggleVoiceChat && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground"
            onClick={onToggleVoiceChat}
            aria-label={voiceChat ? "stop reading replies aloud" : "read replies aloud"}
            aria-pressed={!!voiceChat}
            title={voiceChat ? "Mute my voice in chat" : "Read my replies aloud"}
          >
            {voiceChat ? <SpeakerHighIcon /> : <SpeakerSlashIcon />}
          </Button>
        )}
      </PanelHeader>

      {empty ? (
        <Empty className="gap-3 p-4">
          <EmptyHeader className="gap-1">
            <EmptyTitle className="text-[15px] font-semibold">
              Hey{userName.trim() ? ` ${userName.trim()}` : ""}, what's on your mind?
            </EmptyTitle>
            <EmptyDescription className="text-[13px]">Your day, some gossip, a question. Anything goes.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row flex-wrap justify-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="rounded-full bg-card" onClick={() => onSend(s)}>
                {s}
              </Button>
            ))}
          </EmptyContent>
        </Empty>
      ) : (
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 px-4 pt-0.5 pb-3">
            {messages.map((m, i) => {
              const day = dayLabel(m.at);
              const showDay = day && (i === 0 || dayLabel(messages[i - 1].at) !== day);
              return (
                <Fragment key={i}>
                  {showDay && <DayDivider label={day} />}
                  <Message mine={m.role === "user"} text={m.text} sources={m.sources} />
                </Fragment>
              );
            })}
            {streamText !== null &&
              (streamText ? <Message mine={false} text={streamText} /> : <Typing />)}
          </div>
        </div>
      )}

      <div className="shrink-0 px-3 pb-3">
        <InputGroup className="bg-card">
          <InputGroupTextarea
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
            placeholder={recording ? "Listening..." : `Message ${name}`}
            className="min-h-0 py-2.5 text-[13px] leading-[18px]"
            style={{ maxHeight: INPUT_MAX_H, overflowY: "auto" }}
          />
          <InputGroupAddon align="inline-end" className="self-end pb-1.5">
            <MicButton key={micKey} variant="chat" current={text} onTranscript={setText} onRecordingChange={setRecording} />
            <InputGroupButton
              variant="default"
              size="icon-xs"
              className="size-7 rounded-full disabled:bg-primary/25 disabled:opacity-100"
              onClick={send}
              disabled={!canSend}
              aria-label="send"
            >
              <ArrowUpIcon weight="bold" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </Panel>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
      {label}
    </div>
  );
}

function Typing() {
  return (
    <div className="flex h-5 items-center gap-1" role="status" aria-label="thinking">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-typing rounded-full bg-primary" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

function dayLabel(at: string | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function openLink(e: React.MouseEvent, url: string) {
  e.preventDefault();
  window.companion.openLink(url);
}

const linkClass = "text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary break-all";

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
      nodes.push(
        <strong key={`${keyBase}-${i++}`} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const url = tok.slice(tok.indexOf("(") + 1, -1);
      nodes.push(
        <a key={`${keyBase}-${i++}`} href={url} onClick={(e) => openLink(e, url)} className={linkClass}>
          {label}
        </a>,
      );
    } else {
      nodes.push(
        <a key={`${keyBase}-${i++}`} href={tok} onClick={(e) => openLink(e, tok)} className={linkClass}>
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
    if (!line.trim()) return <div key={li} className="h-1.5" />;
    const bullet = line.startsWith("- ") || line.startsWith("• ");
    const content = renderInline(bullet ? line.slice(2) : line, `l${li}`);
    return bullet ? (
      <div key={li} className="relative my-0.5 pl-3.5 before:absolute before:top-[0.6em] before:left-1 before:size-1 before:rounded-full before:bg-primary/70">
        {content}
      </div>
    ) : (
      <div key={li}>{content}</div>
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

function Message({
  mine,
  text,
  sources,
}: {
  mine: boolean;
  text: string;
  sources?: { title: string; url: string }[];
}) {
  return (
    <div
      className={cn(
        "cursor-text leading-relaxed break-words select-text",
        mine ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-bubble px-3 py-1.5 text-bubble-foreground" : "self-stretch pr-2",
      )}
    >
      {renderRich(text)}
      {sources && sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sources.map((s) => (
            <Badge key={s.url} variant="secondary" asChild className="max-w-[170px] cursor-pointer font-normal hover:bg-bubble">
              <button onClick={() => window.companion.openLink(s.url)} title={s.url}>
                <LinkSimpleIcon />
                <span className="truncate">{shortLabel(s.title)}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
