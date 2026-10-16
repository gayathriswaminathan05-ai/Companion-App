// Phosphor icons (same family as the app) → one SVG sprite for the landing page.
// usage: node scripts/site/build-icons.mjs   → site/assets/icons.svg
// In HTML: <svg class="i"><use href="assets/icons.svg#sun"/></svg>
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as P from "@phosphor-icons/react/ssr";

// sprite id → [Phosphor component, weight]
const ICONS = {
  "sun-horizon": ["SunHorizonIcon", "regular"],
  sun: ["SunIcon", "regular"],
  "moon-stars": ["MoonStarsIcon", "regular"],
  moon: ["MoonIcon", "regular"],
  "speaker-on": ["SpeakerHighIcon", "fill"],
  "speaker-off": ["SpeakerSlashIcon", "fill"],
  wave: ["HandWavingIcon", "fill"],
  apple: ["AppleLogoIcon", "fill"],
  download: ["DownloadSimpleIcon", "bold"],
  "arrow-down": ["ArrowDownIcon", "bold"],
  stretch: ["PersonSimpleTaiChiIcon", "fill"],
  water: ["DropIcon", "fill"],
  task: ["CheckCircleIcon", "fill"],
  restart: ["ArrowCounterClockwiseIcon", "bold"],
  shield: ["ShieldCheckIcon", "regular"],
  mic: ["MicrophoneIcon", "regular"],
  mail: ["EnvelopeSimpleIcon", "regular"],
  calendar: ["CalendarBlankIcon", "regular"],
  trash: ["TrashIcon", "regular"],
  "eye-off": ["EyeSlashIcon", "regular"],
  chat: ["ChatCircleDotsIcon", "regular"],
  share: ["ExportIcon", "bold"],
  folder: ["FolderSimpleIcon", "regular"],
  gear: ["GearSixIcon", "regular"],
  cursor: ["CursorClickIcon", "regular"],
  play: ["PlayIcon", "fill"],
  close: ["XIcon", "bold"],
  pause: ["PauseIcon", "fill"],
  "mic-on": ["MicrophoneIcon", "fill"],
  smiley: ["SmileyWinkIcon", "regular"],
  couch: ["CouchIcon", "regular"],
};

const symbols = Object.entries(ICONS).map(([id, [name, weight]]) => {
  const Icon = P[name];
  if (!Icon) throw new Error(`missing Phosphor icon ${name}`);
  const svg = renderToStaticMarkup(createElement(Icon, { weight }));
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<symbol id="${id}" viewBox="0 0 256 256" fill="currentColor">${inner}</symbol>`;
});

const out = new URL("../../site/assets/icons.svg", import.meta.url);
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`);
console.log(`icons.svg: ${symbols.length} icons`);
