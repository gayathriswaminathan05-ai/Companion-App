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
- Image generation in chat: DEFERRED (user decision July 2026) — revisit only
  after monetization data. When revisited: split is (a) Blob-branded meme
  templates (free, local canvas captioning, uses sprite expressions — also a
  marketing flywheel: shared memes carry the mascot) vs (b) true AI image gen
  (per-image API cost, needs paid tier + caps + safety filter + breaks the
  "chat is the only network call" privacy line — v1.1+ at earliest).

## Known bugs / polish debt (user said "later")
- Settings "change key" deletes key with NO confirm — one stray click disconnects
  brain (happened to user). Make it two-step like delete-everything.
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

- **Chat v2** ✅ LOUD over-the-top personality (gasps/CAPS spikes/huge empathy);
  deep research mode (web_search max_uses 8, max_tokens 2048, multi-angle,
  opinionated synthesis); source citations collected from API → clickable 🔗 chips
  in bubbles → shell.openExternal. Hold-to-talk mic INSIDE input field (micKey
  remount cancels in-flight transcription = input-refill bug fixed). MODEL:
  claude-sonnet-5 (user chose for cost; one-line swap in main.cjs CHAT_MODEL).
  API key: user-funded account, stored userData/brain.key.

- **Chat actions (Day 9 core)** ✅ Blob creates/completes REAL tasks from
  conversation via invisible tags: <task due="local-ISO" recurring="daily">,
  <complete>fuzzy-match</complete> (extractOutputs in brain.ts; applied in App
  chat-done: chrono fallback parse, celebrate+sprout on completes, writing anim
  on adds). Model gets current local ISO datetime in dynamic context.
- **Day 6: Settings** ✅ SettingsPanel (Blob-voiced): names (fed to brain),
  sounds, stretch interval (0=off), water, bedtime time+toggle, joke freq
  (off/3h/6h), call auto-hide toggle, MEMORY VIEWER (see/delete facts, clear
  chats), login item, change key, privacy blurb, delete-everything w/ confirm.
  4am day boundary in today(). CALL AUTO-TUCK: main.cjs polls 10s — Zoom via
  pgrep CptHost, Meet via osascript Chrome tab URLs (one-time automation
  permission); hides during call, restores after; settings.autoHideOnCalls.
- **UX polish** ✅ Juggle 650ms; QuickNav bar (src/ui/QuickNav.tsx): when a panel
  is open, other menu balls line up horizontally above it for 1-click switching
  (colors match menu balls; active=filled). Chat bubbles render markdown-lite
  (bold/bullets/[links](url)/bare URLs clickable → openLink); research answers
  format-locked (opener/bullets/my pick/sources).
- **Sounds** ✅ (Day 6 partial): src/sounds.ts — SYNTHESIZED chirps (WebAudio, no
  files): hello/boop/celebrate/pop/sleepy/giggle/msg; one instrument family;
  settings.soundsOn (default true, toggle in debug menu until Settings panel);
  auto-silent when hidden. Chat composer: Claude-style — mic + circular ↑ send
  inside one rounded field.

- **AI character pipeline** ✅ scripts/process-clip.cjs (ffmpeg-static extract
  12fps no-audio) + scripts/clip-key.cjs (Electron worker: flood-fill chroma key
  from border+top seeds, global magenta cleanup for enclosed pockets, petal-
  resistant bbox crop, 340x400 bottom-anchor) → public/character/<state>/*.png +
  src/generated/sprites.ts. Blob.tsx: SpriteAnim (12fps ping-pong, preloaded)
  replaces procedural drawing per-state when frames exist. IDLE = her AI tree
  character (root creature w/ creepers + flower, 120 frames, 7.4MB). Video note:
  AI clip pans/morphs — union bbox means character size shifts between frames.
  Remaining states still procedural blob. Usage: node scripts/process-clip.cjs
  <video.mp4> <state>.

- **Higgsfield MCP pipeline (July 16)** ✅ Higgsfield MCP connected (hosted,
  OAuth via terminal /mcp — expires sometimes, re-auth same way; account is
  free-tier w/ trial credits, plan purchase pending her judgment). Claude drives
  full loop: upload ref frame (Kling start frame from ~/Downloads/kling_*.mp4)
  → generate_video kling3_0 (start_image+end_image=ref for loops, sound:'off'
  → 7.5 credits/5s, std mode) → download → process-clip → app. get_cost:true
  preflights price free. AI matte tool remove_background = 1 credit (mp4 output,
  no alpha — of limited use). LESSON: fast motion = Kling redraws/blurs vines →
  distortion; prompt "slow, minimal, crisp, keep exact vine shape" fixed it.
  STATES DONE: idle (breathing+2 blinks, start=end frame), dragged (gentle
  dangle tilt, trimmed 0.7s+, ~16.5 credits left). Pipeline upgrades in
  clip-key.cjs: island cleanup (drop components <2% of largest — kills
  watermark/sparkle), MIN=6 bbox (thin vines), UNION crop default (static-cam;
  CLIP_CROP=perframe env for panning sources), meta.json srcW/srcH → sprites.ts
  → Blob.tsx SpriteAnim normalizes per-state scale vs idle (fixes drag shrink).
- **Creeper-flicker saga (RESOLVED)**: idle's detached right creeper strand
  appeared/disappeared. ROOT CAUSE (user diagnosed strand always present in
  raw video): island cleanup's <2%-of-largest rule erased the strand ONLY in
  frames where it didn't touch the vine bundle. Fix: debrisMax =
  min(2%, 1000px) — only true debris (watermark letters/sparkles) dies now.
  DEAD ENDS (don't repeat): two deflicker attempts (scripts/deflicker.cjs —
  erases low-presence pixels; even the morphological "surgical" version reads
  as distortion because the strand legitimately SWAYS; user rejected both).
  LESSON: flicker-scan red = "pixels not always present" — that's motion OR
  popping; use zone pixel-COUNT stability per frame to tell them apart.

- **Menu v2 "merge & spread" + juggling state (July 16)** ✅ RadialMenu.tsx
  rewritten (arc RETIRED): click → blob plays juggling sprite (Kling
  "conducting music" gesture — the wording that finally kept hands EMPTY;
  the word "juggling" in prompts makes Kling paint white balls in) → code
  balls launch alternately from HAND_L/HAND_R consts → converge + tint to
  brown = ONE ball above head → glass pill stretches sideways, balls slide to
  slots (her Pinterest reference).   Liquid glass experiment reverted (broke menu/chat layout); panels use
  frosted glass at ~88% opacity instead. Menu ✕ dismiss stays off pill right.
  Labels are hover-only now. Drag SOUNDS: sounds.ts startDangle/stopDangle —
  chipmunk "eep-eep!" pickup + trembling hum + squeak-down landing (tuned
  softer once; she called v1 "too squeaky"). Dock icon = real character
  (render-icon.cjs composes idle f-001 onto squircle, base64-embedded; enlarged
  after "not legible"). SpriteAnim: resets to frame 0 on state change;
  per-state true-scale normalization via srcW/srcH. STATES with AI sprites:
  idle, dragged, juggling. Credits: 40 bought, ~1.5 left. Higgsfield jobs are
  reusable by job-id (uploaded ref image media_id in CLAUDE history; ref
  frame = first frame of ~/Downloads/kling_20260716_VIDEO_The_cute_t_647_0.mp4).

- **NEW MASCOT: succulent pot creature (July 17)** ✅ Tree Blob retired after
  user testing (nobody liked it). New: vivid coral matte-clay pot + Disney
  eyes + tall green paddle leaves (mascot-options/8-disney-eyes-succulent.png;
  master ref standing = mascot-options/master-ref-standing.png, Higgsfield job
  104f213b-f336-4bcb-96ad-39ce66c0b28d — anchor for ALL generations).
  STATES LIVE: idle(breathe)+idlehop(spontaneous, ~40s)+REST POSES rotating
  every 10min as the default (idle→lying→hammock→meditate→picnic→groove→hula→…;
  each sticks until next swap; interrupted by panels/sleep/nudges),
  stretching(real workout: side bends+cross-body), watering(self-water = water
  nudge), dragged(v1 take, trimmed 2.15-4.8). Raw mp4s in assets/clips/
  (REPROCESSABLE FREE — never regenerate before exhausting keyer fixes:
  CLIP_T tolerance, CLIP_GLOBAL=off solid-char mode, trim windows).
  KEYER UPGRADES: CLIP_T env, CLIP_GLOBAL=off (protects eye whites/pupils),
  shadow-island removal (light desaturated non-largest components), enclosed-
  hole healing (globalOff mode). LESSONS: props need STILLS first (juggle-ball
  trap); "conducting music" ≠ juggling; white bg + bright sheen = use T=15
  (T=8 no better); Kling can lift character out of frame (check RAW frames
  before blaming keying!). Showcase: hidden ✦ at menu bar's left end → plays
  (menu gesture) only. **celebrating** ✅ champagne cork-PULL + spill (human-style):
  still 04ebbaaf; video 4394ad33 (7.5cr) — hand twists/pulls cork, foam spills
  over bottle; trimmed 0–3.55s (cut loop reseal); CLIP_T=15 CLIP_GLOBAL=off;
  45 frames, pingpong=false, TIMED 3.6s. Raw full: celebrating-pull.mp4.
  Alt older hop-pop: celebrating-t1.mp4. **noting** ✅ glasses+notepad+pencil
  still 298045f0; scribble loop video 4b072007 (7.5cr); CLIP_T=15
  CLIP_GLOBAL=off; 61 frames pingpong; writing state reuses noting sprites.
  Showcase has notes. **coffee** ✅ sit+sip for chat open/thinking (still
  coffee-a; video 2740341c; CLIP_T=15 CLIP_GLOBAL=off; 61 frames pingpong).
  **sleeping** ✅ yawn→flop→pull cobalt moon/stars blanket (still 7ead4afa;
  video 19a173a8 7.5cr — yawn start still d77872c0 eyes SQUEEZED shut + wide
  mouth; v1 9dfa996d had open eyes = looked like surprise; 61 frames,
  pingpong=false holdLast=true). Showcase + bedtime nudge.
  Yellow procedural blob retired as fallback — missing states use idle/coffee
  plant sprites. Yellow chair deferred (Soul drifts identity). TODO: more
  celebrations x4, waking/waving/listening, noting pencil-on-page redo,
  combing, growth stills, new voice, landing refresh.
  Credits: ~400 left. **CREDIT DISCIPLINE (owner, July 17):** spend carefully — always
  `get_cost:true` first; fix with FREE keyer/trim reprocess before regenerating;
  prefer 1 video take over parallel takes; stills before video for any prop;
  ask before jobs that cost >~5 credits unless she already approved the shot.
  LESSON: start=end loop reseals story clips — trim before process.

## Status: PAUSED for Figma design refinement (July 2026)
Gayathri is refining all UI designs in Figma. When she returns with links, use
the Figma connector (may need one-time auth) to read frames and implement
faithfully. Design inventory: 3 panels + menu arc, 3 bubble types, quick-nav,
chips/toggles, 13 character poses + 4 sprout stages + arms, palette
(#FFF6E9/#FFCF96/#5a4a3a + 5 ball colors).

## Remaining for beta (after design pass)
- Onboarding flow + trial countdown/paywall/founder code (Days 11-12 in plan)
- Final character art integration (swap procedural blob; single-clock juggle grip)
- Packaging: notarized DMG, bundle Whisper model, real app icon (Day 13)
- Apple Developer enrollment (BEFORE packaging — 24-48h lead)
- Beta distribution: privacy page, feedback form, welcome note (Day 14)
