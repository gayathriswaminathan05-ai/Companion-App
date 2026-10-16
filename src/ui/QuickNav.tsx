// Horizontal quick-switch bar above an open panel. Active panel = filled
// lavender with the solid icon weight; hover = soft lavender (never the same
// as active).
import { MenuIcon, type MenuIconId } from "./MenuIcons";
import { barButtonClass, barClass } from "./RadialMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface QuickNavItem {
  icon: MenuIconId;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export default function QuickNav({ items }: { items: QuickNavItem[] }) {
  return (
    <div data-hit="1" className={cn(barClass, "pointer-events-auto w-fit shrink-0 gap-1 p-1")}>
      {items.map((it) => (
        <Tooltip key={it.label}>
          <TooltipTrigger asChild>
            <button
              onClick={it.onClick}
              aria-label={it.label}
              aria-current={it.active ? "page" : undefined}
              className={cn(
                barButtonClass,
                "size-7",
                it.active
                  ? "bg-primary text-primary-foreground dark:bg-primary dark:text-white"
                  : "hover:bg-secondary hover:text-primary dark:hover:bg-secondary dark:hover:text-[#e4ddff]",
              )}
            >
              <MenuIcon id={it.icon} size={15} active={it.active} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="capitalize">
            {it.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
