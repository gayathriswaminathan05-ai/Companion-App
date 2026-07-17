import { useEffect, useState } from "react";
import type { Settings } from "../store";
import { COLORS, panel, smallBtn, primaryBtn, ghostClose, field } from "./theme";

// Settings, in Blob's own voice — frosted glass shell.

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 0",
  fontSize: 12,
  color: COLORS.text,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  color: COLORS.textSoft,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  margin: "12px 0 4px",
};

const inputStyle: React.CSSProperties = {
  ...field,
  width: 110,
  fontSize: 11.5,
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 34,
        height: 19,
        borderRadius: 10,
        border: "none",
        background: on ? COLORS.accent : "rgba(32, 29, 47, 0.18)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.15s",
        padding: 0,
        minWidth: 34,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 17 : 2,
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
        }}
      />
    </button>
  );
}

export default function SettingsPanel({
  settings,
  facts,
  onPatch,
  onDeleteFact,
  onClearChat,
  onChangeKey,
  onDeleteAll,
  onClose,
}: {
  settings: Settings;
  facts: string[];
  onPatch: (patch: Partial<Settings>) => void;
  onDeleteFact: (fact: string) => void;
  onClearChat: () => void | Promise<void>;
  onChangeKey: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  const [loginItem, setLoginItem] = useState(false);
  const [clearPhase, setClearPhase] = useState<"idle" | "clearing" | "done">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  useEffect(() => {
    (window.companion.getLoginItem() as Promise<boolean>).then(setLoginItem);
  }, []);

  const runClearChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clearPhase !== "idle") return;
    setClearPhase("clearing");
    const started = Date.now();
    try {
      await onClearChat();
    } catch {
      /* still show done — UI state is cleared in parent */
    }
    const wait = Math.max(0, 700 - (Date.now() - started));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    setClearPhase("done");
    window.setTimeout(() => setClearPhase("idle"), 2200);
  };

  return (
    <div
      style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 12, gap: 4 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>settings</span>
        <button style={ghostClose} onClick={onClose} title="close">✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 2, minHeight: 0 }}>
        <div style={sectionTitle}>me & you</div>
        <div style={row}>
          <span>my name</span>
          <input
            style={inputStyle}
            value={settings.companionName}
            onChange={(e) => onPatch({ companionName: e.target.value })}
          />
        </div>
        <div style={row}>
          <span>what I call you</span>
          <input
            style={inputStyle}
            placeholder="your name"
            value={settings.userName}
            onChange={(e) => onPatch({ userName: e.target.value })}
          />
        </div>
        <div style={row}>
          <span>my little sounds</span>
          <Toggle on={settings.soundsOn} onChange={(v) => onPatch({ soundsOn: v })} />
        </div>
        <div style={{ ...row, alignItems: "center" }}>
          <span>how big I look</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}>
            <span style={{ fontSize: 10, color: COLORS.textSoft }}>−</span>
            <input
              type="range"
              min={0.6}
              max={1.2}
              step={0.05}
              value={settings.plantScale}
              onChange={(e) => onPatch({ plantScale: Number(e.target.value) })}
              title={`${Math.round(settings.plantScale * 100)}%`}
              style={{
                flex: 1,
                width: 80,
                accentColor: COLORS.accent,
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 10, color: COLORS.textSoft }}>+</span>
          </div>
        </div>
        <div style={{ ...row, alignItems: "center" }}>
          <span>how big my windows are</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}>
            <span style={{ fontSize: 10, color: COLORS.textSoft }}>−</span>
            <input
              type="range"
              min={0.85}
              max={1.45}
              step={0.05}
              value={settings.panelScale}
              onChange={(e) => onPatch({ panelScale: Number(e.target.value) })}
              title={`${Math.round(settings.panelScale * 100)}%`}
              style={{
                flex: 1,
                width: 80,
                accentColor: COLORS.accent,
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 10, color: COLORS.textSoft }}>+</span>
          </div>
        </div>

        <div style={sectionTitle}>how I care for you</div>
        <div style={row}>
          <span>remind you to stretch</span>
          <select
            style={{ ...inputStyle, width: 96 }}
            value={String(settings.breakMins)}
            onChange={(e) => onPatch({ breakMins: Number(e.target.value) })}
          >
            <option value="0">never</option>
            <option value="30">every 30 min</option>
            <option value="45">every 45 min</option>
            <option value="60">every hour</option>
            <option value="90">every 90 min</option>
          </select>
        </div>
        <div style={row}>
          <span>water breaks</span>
          <Toggle on={settings.waterNudge} onChange={(v) => onPatch({ waterNudge: v })} />
        </div>
        <div style={row}>
          <span>I get sleepy at</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input
              type="time"
              style={{ ...inputStyle, width: 84, opacity: settings.bedtime ? 1 : 0.45 }}
              value={settings.bedtime ?? "23:00"}
              disabled={!settings.bedtime}
              onChange={(e) => onPatch({ bedtime: e.target.value })}
            />
            <Toggle
              on={!!settings.bedtime}
              onChange={(v) => onPatch({ bedtime: v ? "23:00" : null })}
            />
          </div>
        </div>
        <div style={row}>
          <span>my jokes</span>
          <select
            style={{ ...inputStyle, width: 96 }}
            value={settings.jokeEvery}
            onChange={(e) => onPatch({ jokeEvery: e.target.value as Settings["jokeEvery"] })}
          >
            <option value="often">often (3h)</option>
            <option value="rare">rare (6h)</option>
            <option value="off">shh, none</option>
          </select>
        </div>
        <div style={row}>
          <span>hide when you're on a call</span>
          <Toggle on={settings.autoHideOnCalls} onChange={(v) => onPatch({ autoHideOnCalls: v })} />
        </div>

        <div style={sectionTitle}>what I remember</div>
        <button style={{ ...smallBtn, width: "100%" }} onClick={() => setShowMemory((s) => !s)}>
          {showMemory ? "hide my memories" : `see my ${facts.length} memories of you`}
        </button>
        {showMemory && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {facts.length === 0 && (
              <span style={{ fontSize: 11, color: COLORS.placeholder, textAlign: "center" }}>
                nothing yet — talk to me more 🤍
              </span>
            )}
            {facts.map((f) => (
              <div
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  background: COLORS.inputBg,
                  border: "1px solid rgba(32, 29, 47, 0.06)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  color: COLORS.text,
                }}
              >
                <span style={{ flex: 1 }}>{f}</span>
                <button
                  onClick={() => onDeleteFact(f)}
                  title="forget this"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.placeholder, fontSize: 11 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={sectionTitle}>app</div>
        <div style={row}>
          <span>wake up when your Mac starts</span>
          <Toggle
            on={loginItem}
            onChange={(v) => {
              setLoginItem(v);
              void window.companion.setLoginItem(v);
            }}
          />
        </div>
        <div style={row}>
          <span>my brain key</span>
          <button style={{ ...smallBtn, fontSize: 11 }} onClick={onChangeKey}>
            change key
          </button>
        </div>

        <div style={sectionTitle}>privacy</div>
        <div style={{ fontSize: 10.5, color: COLORS.textSoft, lineHeight: 1.5, marginBottom: 6 }}>
          everything lives on this computer. chats go to Claude only to think of a
          reply — never stored, never used for training. voice never leaves at all.
        </div>
        {clearPhase === "idle" && (
          <button
            type="button"
            style={{
              ...smallBtn,
              width: "100%",
              marginBottom: 6,
              color: COLORS.text,
              background: "rgba(32, 29, 47, 0.06)",
            }}
            onClick={runClearChat}
          >
            delete chat history
          </button>
        )}
        {clearPhase === "clearing" && (
          <div
            style={{
              ...smallBtn,
              width: "100%",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: COLORS.textSoft,
              background: "rgba(32, 29, 47, 0.06)",
              cursor: "default",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "2px solid rgba(106, 83, 231, 0.25)",
                borderTopColor: COLORS.accent,
                animation: "settingsSpin 0.7s linear infinite",
                boxSizing: "border-box",
              }}
            />
            deleting…
          </div>
        )}
        {clearPhase === "done" && (
          <div
            style={{
              ...smallBtn,
              width: "100%",
              marginBottom: 6,
              textAlign: "center",
              color: "#1a7a4c",
              background: "rgba(46, 160, 100, 0.12)",
              cursor: "default",
            }}
          >
            deleted
          </div>
        )}
        {!confirmDelete ? (
          <button
            style={{
              ...smallBtn,
              width: "100%",
              color: COLORS.danger,
              background: "rgba(176, 90, 74, 0.1)",
            }}
            onClick={() => setConfirmDelete(true)}
          >
            delete everything
          </button>
        ) : (
          <div style={{ display: "flex", gap: 5 }}>
            <button
              style={{
                ...primaryBtn,
                flex: 1,
                background: COLORS.danger,
              }}
              onClick={onDeleteAll}
            >
              yes, forget me completely
            </button>
            <button style={{ ...smallBtn, flex: 1 }} onClick={() => setConfirmDelete(false)}>
              no wait
            </button>
          </div>
        )}

        <div style={{ fontSize: 10, color: COLORS.placeholder, textAlign: "center", margin: "12px 0 4px" }}>
          companion v0.1.0 beta · made with 🌱
        </div>
      </div>
      <style>{`
        @keyframes settingsSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
