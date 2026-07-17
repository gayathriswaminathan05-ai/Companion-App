// Shared UI tokens — light grey panels (Cursor-like) + lavender accents.
export const COLORS = {
  panelBg: "rgba(243, 243, 243, 0.94)",
  panelBorder: "#ffffff",
  text: "#201d2f",
  textSoft: "rgba(32, 29, 47, 0.62)",
  placeholder: "#9e9e9e",
  inputBg: "#ffffff",
  accent: "#6A53E7",
  accentSoft: "#f5f3ff",
  bubbleLavender: "#e7e3ff",
  bubbleText: "#190681",
  danger: "#b05a4a",
  dangerSoft: "#f5d5cf",
  dangerBorder: "#e0b8b0",
};

export const FONT =
  '"Noto Sans", system-ui, -apple-system, sans-serif';

export const panel: React.CSSProperties = {
  background: COLORS.panelBg,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 20,
  boxShadow: "0 4px 18px rgba(32, 29, 47, 0.12)",
  fontFamily: FONT,
  color: COLORS.text,
  backdropFilter: "blur(40px) saturate(1.4)",
  WebkitBackdropFilter: "blur(40px) saturate(1.4)",
  boxSizing: "border-box",
  position: "relative",
};

export const inputBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  background: COLORS.inputBg,
  borderRadius: 10,
  boxShadow:
    "0 1px 2px rgba(12, 12, 13, 0.1), 0 1px 2px rgba(12, 12, 13, 0.05)",
};

export const smallBtn: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 8,
  border: "none",
  background: COLORS.accentSoft,
  color: COLORS.accent,
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 600,
};

export const primaryBtn: React.CSSProperties = {
  ...smallBtn,
  background: COLORS.accent,
  color: "#ffffff",
};

export const ghostClose: React.CSSProperties = {
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
  fontFamily: "inherit",
  flexShrink: 0,
};

export const field: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid rgba(32, 29, 47, 0.08)",
  outline: "none",
  fontFamily: "inherit",
  background: COLORS.inputBg,
  color: COLORS.text,
  boxShadow: "0 1px 2px rgba(12, 12, 13, 0.06)",
};

export const chip: React.CSSProperties = {
  fontSize: 11,
  background: COLORS.bubbleLavender,
  border: "1px solid rgba(106, 83, 231, 0.18)",
  color: COLORS.bubbleText,
  borderRadius: 8,
  padding: "3px 8px",
};
