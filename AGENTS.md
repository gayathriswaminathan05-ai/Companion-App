# AGENTS.md — read this first

Instructions for AI coding agents (Codex, Claude Code, …) working on this repo.
The full project history and every decision so far is in **[CLAUDE.md](CLAUDE.md)**
(the name is historical: it is the project's memory). Read it before any work,
and **add what you did to it at the end of every work session**.

## Who you're working with
- **Gayathri (owner) has no coding knowledge.** You write all code and run all
  commands. Explain in plain, friendly language: no jargon, no code in your
  replies unless she asks. She decides product and design, tests by looking.
- Always describe what changed in terms of what she will SEE or FEEL.
- Ask before anything hard to undo or public: deleting work, publishing the
  landing page, deploying the chat server, git push, spending AI credits.

## The product (one paragraph)
A Mac desktop companion: a little succulent-pot plant that lives on the desktop,
holds tasks and timed reminders, nudges you to stretch and drink water, chats
like a loud loving best friend (ChatGPT, via our proxy), tells jokes, says
goodnight, and GROWS through 7 stages as you look after yourself (fresh start
every morning, never guilt). Plus a landing/download page (`site/`) and a
narrated trailer (`marketing/trailer/`).

## Run things
- App: `npx vite build && npx electron .` (from the repo root). Relaunch after
  changes; she checks her desktop.
- UI gallery (every panel at real size): `npx vite` → http://localhost:5173/gallery.html
- Landing page: `npx http-server site -p 8790 -c-1` → index.html (version A,
  narrated story) and b.html (version B, Tolan-style). Keep BOTH.
- Chat server tests: `cd proxy && npm test` (31 tests, must stay green).
- Chat personality check: `node scripts/chat-eval.mjs` (20 chats; costs cents;
  `DRY=1` costs nothing).
- Installer: `npm run dist` (Apple-chip DMG, ~500 MB, unsigned beta).

## Hard rules
- **Never commit secrets**: `electron/google-client.json`, `electron/beta-config.json`,
  any `*.key`, `models/`. They are gitignored; keep it that way.
- **Never commit her personal files** in the repo root (WhatsApp exports etc.).
- **Privacy is a product promise** (PRD §6b): everything stays on the Mac; chat
  is the only thing sent out (to the AI, never logged by our proxy); voice is
  transcribed on-device; calendar data stays in memory and never goes to the AI;
  the "Chat with AI" switch off = nothing typed leaves the Mac. Don't add
  analytics, trackers, or new network calls without asking her.
- **Design**: her Figma palette (lavender #6A53E7 primary, #F3F3F3 panels, ink
  #201D2F), Figtree font, shadcn/ui + Tailwind v4, Phosphor icons. No emoji on
  buttons, no em-dashes in UI copy, no gradient banners. Keep every design
  option side by side (add Option B, never overwrite A).
- **AI video/image credits (Higgsfield) are her money**: check the price first,
  fix things for free (re-trim, re-cut) before regenerating, and ask before any
  job over ~5 credits unless she already approved that shot.
- Email (Gmail) is hidden on purpose (costly Google review): `src/features.ts`
  and `electron/calendar.cjs` GMAIL_FEATURE. Don't re-enable without asking.

## Testing tools to remove before the PUBLIC launch (not before)
Gayathri's own testing aids, kept on purpose during the beta:
- Growth test bar beside the plant (src/ui/GrowthTestBar.tsx), dev app only.
- Debug menu on right-click of the plant (DebugMenu in src/App.tsx), dev app only.
- Showcase: the secret ✦ dot at the left end of the menu bar (src/ui/Showcase.tsx).
  This one also shows in the testers' installer.
When she says it's time for the public launch: remove or hide all three.

## Where things are
- `electron/main.cjs` window, tray, saving, AI chat (ChatGPT or Claude: the
  saved key decides), voice, calendar. `electron/preload.cjs` = the bridge.
- `src/App.tsx` all app behaviour; `src/brain.ts` the plant's personality +
  hidden action tags; `src/ui/*` panels; `src/character/Blob.tsx` animations.
- `public/character/<pose>/` animation frames (made from videos in
  `assets/clips/` — raw clips can be re-cut for free).
- `scripts/pipeline/` turning a new video into an app animation
  (`sprite-in.sh <clip> <state>`), re-cutting old ones, size checks.
  Cut-outs use her background remover at `~/Desktop/Background remover`.
- `scripts/site/` landing media/voice/trailer builders; `scripts/site/qa/` page tests.
- `proxy/` Cloudflare Worker (chat + cloud voice), see `proxy/README.md`.
- `docs/wireframes/` all design wireframes (pictures in `snapshots/`);
  `docs/tester-guide/` the beta tester guide page.
