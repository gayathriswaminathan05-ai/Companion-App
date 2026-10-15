// Menu v7: floating pill bar above the plant. Round icon buttons, labels as
// shadcn tooltips, small close button riding the bar's top-right corner.
import { XIcon } from "@phosphor-icons/react";
import { MenuIcon, type MenuIconId } from "./MenuIcons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RadialItem {
  icon: MenuIconId;
  label: string;
  onClick: () => void;
}

const WIN_W = 384;
const WIN_H = 600;
const CHAR_H = 240;
const PLANT_X = 192;
const MENU_GAP = 55;
const BTN = 36;
const ICON = 19;
const GAP = 6;
const PILL_PAD = 6;
const CLOSE = 22;

// Figma colours: grey 94% pill with a white edge; white round buttons with
// lavender icons that fill lavender on hover.
export const barClass =
  "flex items-center rounded-full border border-white bg-background/94 shadow-float dark:border-white/8";
export const barButtonClass =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-bar-btn outline-none transition-[background-color,color,transform] duration-150 hover:bg-primary hover:text-primary-foreground active:scale-[0.92] focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-card";

export default function RadialMenu({
  items,
  clipLeft,
  clipRight,
  clipTop = 0,
  clipBottom = 0,
  plantScale = 1,
  onDismiss,
  onSecret,
}: {
  items: RadialItem[];
  clipLeft: number;
  clipRight: number;
  clipTop?: number;
  clipBottom?: number;
  plantScale?: number;
  onDismiss?: () => void;
  onSecret?: () => void;
}) {
  const scale = Math.min(1.2, Math.max(0.6, plantScale || 1));
  const pillH = PILL_PAD * 2 + BTN + 2;
  let barY = WIN_H - CHAR_H * scale - MENU_GAP;
  barY = Math.max(clipTop + pillH / 2 + 8, Math.min(barY, WIN_H - clipBottom - pillH / 2 - 8));

  const n = items.length;
  const pillW = PILL_PAD * 2 + n * BTN + (n - 1) * GAP + 2;

  const visL = clipLeft + 5;
  const visR = WIN_W - clipRight - 5;
  // Leave a little room on the right for the floating close button.
  const closePad = onDismiss ? CLOSE / 2 + 4 : 0;
  let barX = Math.min(Math.max(PLANT_X, visL + pillW / 2), visR - pillW / 2 - closePad);
  if (visR - visL < pillW + closePad) barX = (visL + visR - closePad) / 2;

  const pillLeft = barX - pillW / 2;
  const pillTop = barY - pillH / 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-[9]">
      <div
        data-hit="1"
        className={cn(barClass, "pointer-events-auto absolute animate-in fade-in-0 zoom-in-95 duration-200")}
        style={{ left: pillLeft, top: pillTop, width: pillW, height: pillH, gap: GAP, padding: PILL_PAD }}
      >
        {onSecret && (
          <button
            onClick={onSecret}
            aria-label="showcase"
            title="showcase"
            className="absolute top-1/2 left-0.5 size-3 -translate-y-1/2 text-[7px] text-primary opacity-15 transition-opacity hover:opacity-70"
          >
            ✦
          </button>
        )}

        {items.map((item, i) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <button
                onClick={item.onClick}
                aria-label={item.label}
                className={cn(barButtonClass, "animate-in fade-in-0 zoom-in-50 fill-mode-backwards")}
                style={{ width: BTN, height: BTN, animationDelay: `${60 + i * 35}ms` }}
              >
                <MenuIcon id={item.icon} size={ICON} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="capitalize">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="close menu"
          title="Close"
          data-hit="1"
          className="pointer-events-auto absolute z-[11] inline-flex items-center justify-center rounded-full border border-white bg-white/92 text-muted-foreground shadow-float transition-colors animate-in fade-in-0 zoom-in-50 fill-mode-backwards hover:bg-primary hover:text-primary-foreground dark:border-white/8 dark:bg-card"
          style={{
            left: pillLeft + pillW - CLOSE / 2 - 2,
            top: pillTop - CLOSE / 2 - 2,
            width: CLOSE,
            height: CLOSE,
            animationDelay: `${60 + n * 35}ms`,
          }}
        >
          <XIcon size={11} weight="bold" />
        </button>
      )}
    </div>
  );
}
