# Companion App — Project State

A desktop companion: cute blob character that lives on the desktop, manages tasks,
chats, reminds, and cares for the user. Full vision in [PRD.md](PRD.md); day-by-day
plan in [BUILD_PLAN.md](BUILD_PLAN.md). **Keep this file updated after every work
session — it is the cross-session memory.**

## Working style (IMPORTANT)
- Gayathri (owner) has NO coding knowledge. Claude writes all code, runs all
  commands, explains in plain language. She product-owns, tests visually, decides.
- She generates character art herself (later); placeholder vector blob for now.
- Launch app: `npx vite build && npx electron .` from repo root (needs sandbox off).
- Test flow: relaunch → she looks at her desktop → reports back.

## Progress (Days 1–4 DONE, ahead of schedule)
- **Day 1** ✅ Electron shell: transparent always-on-top window, click-through
  outside character, manual drag + position memory, tray (🍡) + Dock icon
  (squircle, generated from assets/icon.svg via scripts/render-icon.cjs).
- **Day 2** ✅ Animation engine: state machine (src/character/) with poses: idle,
  sleeping (yawn→flop-on-side→zzz from mouth), waking, waving, celebrating,
  writing (notebook + SPECTACLES — signature trait), stretching, listening,
  thinking, juggling, noting, dragged. 12fps JS ticker for perpetual poses (CPU
  2–4%). Sprout = separate layer, 4 stages (bud/leaf/leaves/bloom).
- **Day 3** ✅ Radial juggle menu (click blob → physics 5-ball cascade juggled in
  hands ~1.1s → balls thrown into snug arc that leans away from screen edges).
  Colored balls morph into cream widgets. 4 balls: chat, tasks, settings(soon),
  tuck away. Panels: cozy cream cards.
- **Day 4** ✅ **Unified tasks** (user insight: todos ≡ reminders — merged): one
  list, any task can carry a time via chrono-node NL parsing ("call amma at 6pm",
  "stretch daily at 11"); live parse-echo chip + "no, just add it"; quick-picks
  when no time; edit (✏️) text+time inline; timed tasks ring: bubble over blob +
  system notification + done/snooze; missed-while-away recovery; daily recurring.
  Sprout grows on completions. **Voice input**: local Whisper (transformers.js,
  Xenova/whisper-tiny.en, model cached in node_modules/@huggingface/.cache) — live
  dictation via 1.4s chunked re-transcription; VAD (volume-based) drives pen.
  **Noting pose**: tasks panel open → blob holds notepad w/ spectacles; pen
  scribbles only while typing/speaking, pauses on inactivity.
- **Day 5** ✅ Wellness engine (src/App.tsx): powerMonitor idle tracking (30s tick;
  <60s idle = active, >5min idle = real break resets clock); stretch nudge at
  settings.breakMins (60 default); water nudge opt-in (2h, default off); bedtime
  care (settings.bedtime 23:00 default — blob yawns+sleeps + one line, once/evening,
  click wakes it); caps: ≤4 proactive/day + 15min gap + suppressed when hidden/
  panel-open/sleeping/dragged. NudgeBubble component (did it!🌱 grows sprout /
  not now). Tray: Focus hide-for-30min/1hr (auto-return), Start-at-login checkbox.
  Debug menu has nudge test buttons (bypass caps via triggerNudge).

## Key decisions
- ONE character (mochi blob w/ head-sprout; hedgehog/penguin were candidates).
  Flat chunky art style for v1; glow-spirit style = v2 night mode idea.
- Sprout = anti-Finch accomplishment mechanic: ONLY grows, resets fresh daily,
  no streaks/guilt. Thresholds: 1/3/5 points → leaf/leaves/bloom.
- Emotional contract: character cares for user, never demands care.
- Unfinished tasks: stay silently in one list, NO date-guilt-piles; AI asks gently
  after ~3 days (Day 8+).
- Privacy = PRD §6b (binding): local-first, voice never leaves device, chat is the
  only network flow (via proxy, no content logging), no tracking, delete-all.
- Voice: local Whisper forever-free; bundle model INTO installer on Day 13
  (BUILD_PLAN has it). Cloud STT = optional quality upgrade later.
- Monetization (PRD §12): free = 15 msgs/day + short memory; paid $4.99/mo =
  unlimited chat + long memory + adaptive care. 7-day trial, founder code in beta,
  NO payment processing until v1.1.
- Apple Developer enrollment DEFERRED — must start by Day 10 (BUILD_PLAN).

## Known bugs / polish debt (user said "later")
- VAD pen-pause doesn't trigger reliably while speaking pauses (threshold 0.015
  likely too low vs ambient noise → raise / make adaptive).
- Menu arc edge cases: minor overlaps/jitter possible when hard against edges.
- Juggle "true finger grip" — needs arms+balls on one clock; bundled with final
  art integration (Day 12).
- First mic use after cold launch has model-load delay.
- Old two-panel data auto-migrates (reminders[] → todos[] w/ due) on load.

## Architecture map
- electron/main.cjs — window, tray, drag, click-through, data JSON persistence
  (userData/companion-data.json), layout-info (edge clipping), Whisper transcribe
  (dynamic import @huggingface/transformers), mic permission.
- electron/preload.cjs — window.companion bridge.
- src/App.tsx — all state orchestration: panels, task engine (8s check, fire/
  snooze/recover), sprout, juggle menu phases, scribble activity (typePulse +
  recording), drag-vs-click (5px threshold).
- src/character/ — types, useCharacter (TIMED auto-return states), Blob.tsx
  (all poses + CSS anims + specs + arms w/ hands).
- src/ui/ — RadialMenu (juggle physics + arc layout), TaskPanel, ChatPanel
  (canned replies until Day 8), MicButton (record→16k mono→transcribe, VAD),
  ReminderBubble, DebugMenu (right-click), theme.
- src/store.ts — AppData{todos, reminders(legacy), sprout}, migration.
- src/reminders.ts — chrono-node parse/format helpers.


- **Day 8 (pulled forward)** ✅ Chat brain: src/brain.ts (personality: gossip-loving
  best-friend, friend-not-therapist tiers, <remember> fact tags, follow-up-on-open-
  loops hook), main.cjs Claude API integration (model claude-opus-4-8, streaming
  via chat-chunk/done/error IPC, web_search_20260209 tool, pause_turn loop, prompt
  caching on personality block). Key: userData/brain.key (local only, connect card
  in ChatPanel). Memory: data.chat {messages(cap60), facts(cap40), summary,
  jokeLastAt}. Jokes: every 3h (10min checker, suppressed like nudges) — API-
  generated "what do you call…?" w/ FALLBACK_JOKES offline; two-phase bubble
  (what?🤔 → punchline + celebrating). Debug: joke test button.
  NOT YET: task commands via chat tools (Day 9), summary compaction (Day 10),
  15/day free cap (beta unlocked).

## Next: Day 6–7 — settings panel + cute sounds + week-1 buffer
Settings UI edits store.settings (breakMins/bedtime/water/sounds toggles, names,
delete-all). ~6 chirp sounds w/ mute + auto-mute when hidden. Then Day 8: proxy +
Claude chat brain (personality + distress tiers + NL task commands via tool use).
