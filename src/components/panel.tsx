// App-level composites shared by the chat / tasks / settings panels.
// Built from shadcn primitives; owns no colours of its own (see index.css).
import * as React from "react";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GrowthStage } from "@/growth";

/** Plant-stage icon: the real plant at that stage, in full colour
 *  (public/icons/stage-N.png, made by scripts/make-stage-icons.py). */
export function GrowthIcon({ stage, className }: { stage: GrowthStage; className?: string }) {
  return (
    <img
      src={`./icons/stage-${stage}.png`}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("size-4 shrink-0 object-contain", className)}
    />
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-white bg-background/94 text-[13px] text-foreground shadow-panel dark:border-white/8",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  children,
  onClose,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 shrink-0 items-center gap-2 py-2 pr-2 pl-4", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="close" className="text-muted-foreground">
        <XIcon />
      </Button>
    </div>
  );
}

export function SectionLabel({
  children,
  count,
  className,
}: {
  children: React.ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 px-1 pt-4 pb-1.5 text-xs font-semibold text-muted-foreground first:pt-0.5", className)}>
      {children}
      {count !== undefined && <span className="font-medium text-muted-foreground/70 tabular-nums">{count}</span>}
    </div>
  );
}

/** Speech bubble rising from the plant (Finch / Me+ pattern): reminders,
 *  care nudges, jokes, meetings. Tail points down at the character. */
export function SpeechBubble({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble"
      data-hit="1"
      className={cn(
        // Horizontal spot comes from App (--bubble-left / --bubble-tail): centred
        // over the plant, but slid inward when the plant sits in a screen corner
        // so the bubble stays fully visible; the tail keeps pointing at the plant.
        "pointer-events-auto absolute bottom-[214px] left-[var(--bubble-left,calc(50%-8rem))] z-20 w-64 origin-bottom animate-bubble-in rounded-2xl border border-white bg-background p-3.5 text-[13px] text-foreground shadow-panel dark:border-white/8",
        "after:absolute after:-bottom-[7px] after:left-[var(--bubble-tail,50%)] after:size-3 after:-translate-x-1/2 after:rotate-45 after:border-r after:border-b after:border-white after:bg-background dark:after:border-white/8",
        className,
      )}
      {...props}
    />
  );
}

/** Bordered white list container; rows inside get hairline dividers. */
export function ListCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground [&>*+*]:border-t [&>*+*]:border-t-border",
        className,
      )}
      {...props}
    />
  );
}
