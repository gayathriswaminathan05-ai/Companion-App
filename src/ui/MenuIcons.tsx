// Menu glyphs: Phosphor (same family as every other icon in the app).
// Active items switch to the filled weight.
import { ChatCircleDotsIcon, GearSixIcon, ListChecksIcon, MoonStarsIcon, WindIcon } from "@phosphor-icons/react";

export type MenuIconId = "chat" | "tasks" | "settings" | "tuck" | "breathe";

const ICONS = {
  chat: ChatCircleDotsIcon,
  tasks: ListChecksIcon,
  settings: GearSixIcon,
  tuck: MoonStarsIcon,
  breathe: WindIcon,
} as const;

export function MenuIcon({ id, size = 20, active = false }: { id: MenuIconId; size?: number; active?: boolean }) {
  const Icon = ICONS[id];
  return <Icon size={size} weight={active ? "fill" : "regular"} aria-hidden />;
}
