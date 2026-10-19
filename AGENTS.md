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
holds tasks and timed reminders (typed or dictated locally), shows optional Google
Calendar alerts, nudges you to stretch, walk and drink water, tells jokes, says
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
- **Current beta: no AI chat** (owner Oct17, supersedes earlier chat-as-core rule).
  Shared release flag is electron/features.json; keep chat UI and main-process
  requests disabled, even with old consent, saved keys or proxy configuration.
  Keep existing chat code/data for later; do not restore chat without owner approval.
  Keep Google Calendar connections/alerts and voice input for tasks/reminders.
- **Privacy is a product promise**: tasks/settings stay local; voice transcription
  and speaking run on-device. Optional Calendar communicates with Google; fetched
  event details stay in memory, not app storage or AI. New Calendar connections
  request read-only event access. No cloud chat/voice calls in this beta. Don't add
  analytics, trackers, or new network calls without asking her. Review legacy data
  deletion controls and make the privacy page/tester guide match this beta.
- **Deferred chat remains OpenAI only** (owner Oct17): do not restore Claude/Anthropic SDKs, routes,
  keys or environment fallbacks. Historical mentions in CLAUDE.md are not current configuration.
- **Design**: her Figma palette (lavender #6A53E7 primary, #F3F3F3 panels, ink
  #201D2F), Figtree font, shadcn/ui + Tailwind v4, Phosphor icons. No emoji on
  buttons, no em-dashes in UI copy, no gradient banners. Keep every design
  option side by side (add Option B, never overwrite A).
- **AI video/image credits (Higgsfield) are her money**: check the price first,
  fix things for free (re-trim, re-cut) before regenerating, and ask before any
  job over ~5 credits unless she already approved that shot.
- **Character animation workflow**: read
  `docs/art/skills/companion-character-animation/SKILL.md` before preparing mascot
  generations. Match both the existing movement and approved appearance.
  Preserving hand anatomy does not mean freezing hands; meditation includes gentle
  floating, arm/hand drift and leaf sway. Check the full prompt before spending.
- Email (Gmail) is hidden on purpose (costly Google review): `src/features.ts`
  and `electron/calendar.cjs` GMAIL_FEATURE. Don't re-enable without asking.

## Testing tools to remove before the PUBLIC launch (not before)
Gayathri's own testing aids, kept on purpose during the beta:
- Growth test bar beside the plant (src/ui/GrowthTestBar.tsx), dev app only.
- Debug menu on right-click of the plant (DebugMenu in src/App.tsx), dev app only.
- Settings → Test reminders & jokes (src/ui/ReminderTestPanel.tsx), dev app only.
  Previews must never change real tasks, schedules, nudge limits or growth points.
- Showcase: the secret ✦ dot at the left end of the menu bar (src/ui/Showcase.tsx).
  This one also shows in the testers' installer.
When she says it's time for the public launch: remove or hide all testing tools above.

## Where things are
- `electron/main.cjs` window, tray, saving, AI chat (OpenAI only; no other provider or fallback), voice, calendar. `electron/preload.cjs` = the bridge.
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
