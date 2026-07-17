import { useEffect, useRef } from "react";

/** Which edge/corner is being dragged. */
type Edge = "n" | "e" | "w" | "ne" | "nw";

const HIT = 7; // invisible hit strip thickness (px)
const CORNER = 14;

const EDGES: { edge: Edge; cursor: string; style: React.CSSProperties }[] = [
  {
    edge: "n",
    cursor: "ns-resize",
    style: { top: -HIT / 2, left: CORNER, right: CORNER, height: HIT },
  },
  {
    edge: "e",
    cursor: "ew-resize",
    style: { right: -HIT / 2, top: CORNER, bottom: CORNER, width: HIT },
  },
  {
    edge: "w",
    cursor: "ew-resize",
    style: { left: -HIT / 2, top: CORNER, bottom: CORNER, width: HIT },
  },
  {
    edge: "ne",
    cursor: "nesw-resize",
    style: { top: -HIT / 2, right: -HIT / 2, width: CORNER, height: CORNER },
  },
  {
    edge: "nw",
    cursor: "nwse-resize",
    style: { top: -HIT / 2, left: -HIT / 2, width: CORNER, height: CORNER },
  },
];

function clampScale(v: number) {
  return Math.min(1.45, Math.max(0.85, Math.round(v * 100) / 100));
}

/**
 * Edge/corner resize handles — double-arrow cursors on hover, drag to resize.
 * Panel is bottom-anchored, so we expose top + sides + top corners.
 */
export default function PanelResizeHandles({
  scale,
  onScaleLive,
  onScaleCommit,
}: {
  scale: number;
  onScaleLive: (v: number) => void;
  onScaleCommit: (v: number) => void;
}) {
  const drag = useRef<{
    edge: Edge;
    startX: number;
    startY: number;
    startScale: number;
  } | null>(null);
  const liveRef = useRef(scale);
  liveRef.current = scale;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      e.preventDefault();
      let delta = 0;
      const dx = e.clientX - d.startX;
      const dy = d.startY - e.clientY; // drag upward → taller
      if (d.edge.includes("e")) delta += dx / 420;
      if (d.edge.includes("w")) delta -= dx / 420;
      if (d.edge.includes("n")) delta += dy / 380;
      onScaleLive(clampScale(d.startScale + delta));
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      onScaleCommit(liveRef.current);
      window.companion?.setClickThrough(true);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onScaleLive, onScaleCommit]);

  const start = (edge: Edge, cursor: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.companion?.setClickThrough(false);
    document.body.style.cursor = cursor;
    drag.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startScale: scale,
    };
  };

  return (
    <>
      {EDGES.map(({ edge, cursor, style }) => (
        <div
          key={edge}
          role="separator"
          aria-orientation={edge === "n" ? "horizontal" : "vertical"}
          aria-label={`resize ${edge}`}
          onMouseDown={(e) => start(edge, cursor, e)}
          style={{
            position: "absolute",
            zIndex: 40,
            cursor,
            ...style,
          }}
        />
      ))}
    </>
  );
}
