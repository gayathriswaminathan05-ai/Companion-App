import { useEffect, useState } from "react";
import type { Settings } from "../store";
import { panel, smallBtn } from "./theme";

// Settings, in Blob's own voice (Finch pattern: settings stay in-character).

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "5px 0",
  fontSize: 12,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  color: "#b3a284",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  margin: "10px 0 2px",
};

const inputStyle: React.CSSProperties = {
  fontSize: 11.5,
  padding: "4px 7px",
  borderRadius: 6,
  border: "1px solid #d8c9ac",
  outline: "none",
  fontFamily: "inherit",
  background: "#fffdf7",
  color: "#5a4a3a",
  width: 110,
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
        background: on ? "#93C46F" : "#d8cbb4",
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
          background: "#fffdf7",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
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
  onClearChat: () => void;
  onChangeKey: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  const [loginItem, setLoginItem] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  useEffect(() => {
    (window.companion.getLoginItem() as Promise<boolean>).then(setLoginItem);
  }, []);

  return (
    <div style={{ ...panel, display: "flex", flexDirection: "column", height: "100%", padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>settings ⚙️</span>
        <button style={{ ...smallBtn, padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
        <div style={sectionTitle}>🌱 me & you</div>
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

        <div style={sectionTitle}>💛 how I care for you</div>
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

        <div style={sectionTitle}>🧠 what I remember</div>
        <button style={{ ...smallBtn, width: "100%" }} onClick={() => setShowMemory((s) => !s)}>
          {showMemory ? "hide my memories" : `see my ${facts.length} memories of you`}
        </button>
        {showMemory && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5 }}>
            {facts.length === 0 && (
              <span style={{ fontSize: 11, color: "#b3a284", textAlign: "center" }}>
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
                  background: "#fffdf7",
                  border: "1px solid #eee2c8",
                  borderRadius: 7,
                  padding: "4px 7px",
                }}
              >
                <span style={{ flex: 1 }}>{f}</span>
                <button
                  onClick={() => onDeleteFact(f)}
                  title="forget this"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c9b89a", fontSize: 11 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button style={{ ...smallBtn, fontSize: 11 }} onClick={onClearChat}>
              forget all our chats (keeps tasks)
            </button>
          </div>
        )}

        <div style={sectionTitle}>⚙️ app</div>
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

        <div style={sectionTitle}>🔒 privacy</div>
        <div style={{ fontSize: 10.5, color: "#a08e70", lineHeight: 1.5, marginBottom: 5 }}>
          everything lives on this computer. chats go to Claude only to think of a
          reply — never stored, never used for training. voice never leaves at all.
        </div>
        {!confirmDelete ? (
          <button style={{ ...smallBtn, width: "100%", color: "#b05a4a", borderColor: "#e0b8b0" }} onClick={() => setConfirmDelete(true)}>
            delete everything
          </button>
        ) : (
          <div style={{ display: "flex", gap: 5 }}>
            <button
              style={{ ...smallBtn, flex: 1, background: "#f5d5cf", borderColor: "#d89a8e", color: "#8a3a2a" }}
              onClick={onDeleteAll}
            >
              yes, forget me completely
            </button>
            <button style={{ ...smallBtn, flex: 1 }} onClick={() => setConfirmDelete(false)}>
              no wait
            </button>
          </div>
        )}

        <div style={{ fontSize: 10, color: "#c5b696", textAlign: "center", margin: "10px 0 4px" }}>
          companion v0.1.0 beta · made with 🌱
        </div>
      </div>
    </div>
  );
}
