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
  only network flow to Claude (via proxy, no content logging), no tracking,
  delete-all. Calendar: Google read-only fetch stays in Electron RAM for meeting
  pings only — never saved, never included in Claude prompts.
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
- src/ui/ — RadialMenu (pill menu bar), QuickNav, TaskPanel, ChatPanel,
  SettingsPanel, MicButton (record→16k mono→transcribe, VAD), ReminderBubble,
  NudgeBubble, Showcase, MenuIcons (Phosphor map).
- UI FOUNDATION = shadcn/ui + Tailwind v4 (since Oct 15). components.json
  (style radix-nova, iconLibrary phosphor). src/components/ui/* = shadcn code
  we own (input-group/input/textarea tweaked: text-sm always, input-group only
  dims when its text field is disabled). src/components/panel.tsx = app
  composites. src/index.css = theme tokens (clay primary, leaf success, slate
  neutrals, dark set) + keyframes. NO body background (transparent window).
  Add components: `npx shadcn@latest add <name>` (sandbox off), then fix
  imports if needed. Alias "@/" → src (vite.config + tsconfig paths).
- src/dev/gallery.tsx + gallery.html — dev-only UI gallery (every panel/bubble
  at real size, mocked window.companion, accent + light/dark switcher).
  `npx vite` → localhost:5173/gallery.html. Not in the vite build.
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
  stretching(real workout: side bends+cross-body), watering(per-stage self-water
  watering1..6 = water nudge; start=end stage still; oneshot TIMED 5.2s),
  dragged(v1 take, trimmed 2.15-4.8). Raw mp4s in assets/clips/
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
  combing, new voice, landing refresh.
  Credits: ~246 left (July 18). **CREDIT DISCIPLINE (owner, July 17):** spend carefully — always
  `get_cost:true` first; fix with FREE keyer/trim reprocess before regenerating;
  prefer 1 video take over parallel takes; stills before video for any prop;
  ask before jobs that cost >~5 credits unless she already approved the shot.
  LESSON: start=end loop reseals story clips — trim before process.

- **Plant growth (July 18)** ✅ Wellness (stretch/water) = main path (+2 pts);
  timed-task complete = small bonus (+1); plain tasks celebrate only. Cap 10 pts /
  **6 stages** / day (resets 4am). Art: ONE continuous idle growth clip
  (`public/character/growth`, 61 frames) sliced into 6 frame bands. v3
  (3443d0a0; start df994607 / end 8d42ea21, ~10.5cr): magenta plate + tiny
  paddles → lush → pink BUD (stage 5) → soft pink BLOOM (stage 6). Soft pink
  (not magenta) so keyer keeps petals. Gradient BG would NOT help — flood-fill
  needs solid chroma. Level-up scrubs forward; idle holds + breathe. Rest-pose
  rotation off. Weekly stats in Settings. Debug → stages 1–6.
  **growth idle (July 19)** ✅ Six SEPARATE stage loops (not one time-lapse):
  stills from `246d81d6` → stage-1..6.png → Kling blink+breathe videos
  (jobs 4c0ec9a2 / d0704394 / be146e07 / 19d6dfef / 5d4a2b5f / e4e20b01)
  → `assets/clips/growth1..6.mp4` → `public/character/growth1..6` (61fr each,
  CLIP_GLOBAL=off T=18). Idle plays `SPRITES.growthN` ping-pong.
  **drag per stage (July 19)** ✅ Matching `draggedgrowth1..6` (jobs 0a95b46a /
  e53189b9 / 1b7e5a9b / 1b778808 / 37aeedc3 / 2cba96dd; ~45cr). Prompted white
  plate (avoid magenta fringe); Kling kept magenta on 2/4/6 — trimmed white
  middles for 1/3/5, mid-drag for 2/4/6; white key CLIP_T=28 global-on; magenta
  CLIP_T=18 GLOBAL=off + plate killer + polish-sprites. Blob drag plays
  `SPRITES.draggedgrowthN` + soft CSS sway. LESSON: start=end still locks plant;
  prefer white BG for keying; if start=end is idle still, trim away pose morph.

- **Google Calendar meeting reminders (July 17)** ✅ Settings → Calendar:
  connect Google (OAuth Desktop client + read-only scope). Polls next 3h of
  timed events in main process RAM; fires a bubble N minutes early
  (settings.calendarLeadMins). PRIVACY HARD RULE: event titles/times NEVER
  written to companion-data.json (data-save strips calendar payloads); NEVER
  sent to Claude (chatSend only gets brain system+messages). Disk only holds
  OAuth tokens + Google client id/secret (userData/google-calendar*.json) and
  the on/off + lead-mins toggles. Disconnect / delete-everything clears tokens.
  **meeting pose** ✅ handbell ring clip (magenta plate → keyed; oneshot;
  church-chime sound). Showcase ✦ → bell.
  **stretch/walk (visor+high-tops)** ✅ stretching1–6 wired (Blob picks
  stretching${growthStage}). Prefer WHITE plate (cleaner than magenta).
  walk6 = user-keyed black plate → stretching6 + white-stray edge clean;
  short stretch then long walk.

## UI pass v3 (Oct 15, 2026) ✅ — shadcn/ui rebuild, her Figma colours
Her ask: use a real design system so it doesn't look like AI slop. v2 (custom
ui.css, hand-drawn icons) was replaced same day. Now: shadcn/ui (Radix) +
Tailwind v4, Figtree font, Phosphor icons. COLOURS = HER FIGMA PALETTE, KEEP
INTACT (she rejected a mascot-terracotta theme): #F3F3F3 94% panels w/ white
edge, white inputs/cards, lavender #6A53E7 primary, #F5F3FF soft secondary
buttons, #E7E3FF/#190681 user bubbles + chips, #201D2F ink, #B05A4A danger,
white menu buttons w/ lavender icons → solid lavender on hover. Green only for
growth/"connected", amber for past-due. All tokens in src/index.css.
Panels/bars/bubbles have a hairline OUTER edge + deeper shadow so they stay
visible over white apps (her report). Removed tells: sparkle icon, gradient
banner, decorative dots, emoji on buttons, em-dashes in UI copy.
Mobbin refs + rules: DESIGN_REFERENCES.md. Layout/behaviour: chat (plain-text
Blob, lavender user bubbles, day dividers, empty state w/ 3 suggestion
buttons, typing dots, source badges), tasks (Scheduled / Anytime / Done today
/ Earlier collapsible, round lavender checks, hover edit/delete), settings
(This week stats, grouped Item rows w/ Switch / NativeSelect / Slider,
memories Collapsible, change-key + delete-all TWO-STEP), speech bubbles, menu +
QuickNav (tooltips; QuickNav active = filled, hover = soft lavender).
THEME: src/usePanelTheme.ts. Default follows macOS light/dark. Opt-in
settings.matchBackdrop "Match what's behind me" (PRD §6b rule 8): main.cjs
`screen-access` (asks macOS Screen Recording only when toggled on, opens
System Settings if denied) + `backdrop-luminance` (desktopCapturer quarter-size
thumbnail, averages 40pt bands left/right/above the panel stack, returns ONE
number). Renderer polls every 4s while any UI shows; >0.62 → dark panels,
<0.42 → light (hysteresis). NOT yet verified end-to-end: needs her to grant
Screen Recording to Electron (dev) + relaunch. Gallery has "Behind: wallpaper /
white / grey / dark app" + Light/Dark switch for checking visibility.
Pricing/paywall copy intentionally NOT added yet.

## Beta push (Oct 15, 2026) — "finish today, share with testers"
- CONFETTI: src/character/ClayConfetti.tsx (canvas, matte-clay leaves/petals/
  pebbles/sparkles, physics + flutter); old PNG confetti (public/fx) deleted.
- STAGE 7 "in full bloom": still mascot-poses/growth-stages/stage-7.png (gpt_image_2_5
  job 72455a45, white BG; alt = stage-7-alt.png), idle Kling job b6f2e26d (7.5cr)
  → assets/clips/growth7.mp4 → public/character/growth7. Keyed with NEW
  CLIP_WHITE_BG=1 (petal-protect rule used to match pure white) + CLIP_T=30
  CLIP_GLOBAL=off. growth7 pot measured 9% smaller in source → Blob spriteScale
  ×1.09. Growth now 7 stages, 12 pts (stage 7 at 12). Poses without stage-7 art
  (stretch/water/meeting/grow transition) fall back to the nearest lower stage
  via stageSprite(); 6→7 level-up plays celebrating + confetti.
- WATER: settings.waterMins (30-180) select; nudge after that much activity.
- GOOGLE: calendar.cjs + gmail.cjs (subagent). Scopes calendar.events +
  gmail.metadata (headers only). Bundled client = electron/google-client.json
  (GITIGNORED, copied from userData). Chat can book: brain <meeting start end
  with> tag (only offered when canCreateEvents) → Add/Not now bubble →
  calendar-create-event. Gmail Primary-inbox alerts (settings.gmailAlerts) →
  bubble; RAM only. Old read-only connections show "Reconnect". Testing-mode
  caveats: test users only, weekly reconnect (google-auth-expired toast),
  gmail.metadata is RESTRICTED (public launch needs paid security assessment).
- CHAT PROXY: proxy/ (Cloudflare Worker, tests pass, NOT deployed yet — needs
  her Cloudflare account; README has steps). main.cjs: local brain.key wins;
  else electron/beta-config.json {proxyUrl, appToken} (GITIGNORED) → SDK
  baseURL=proxy + anonymous device-id. Daily limit 429 "daily_limit" → friendly
  nap message. Settings hides key row for proxy users.
- WELCOME: first-run bubble (settings.welcomed).
- PACKAGING: `npm run dist` = vite build → scripts/optimize-sprites.cjs (dist PNG
  → WebP q90 lossless-alpha, ~14% size, rewrites bundle paths) → electron-builder
  arm64 DMG, ad-hoc signed (identity "-"; signIgnore skips onnx/png/webp/json —
  osx-sign crashed on .onnx). Whisper base.en bundled to Resources/models
  (packaged app sets env.localModelPath/cacheDir). Excludes transformers
  .cache dup + linux/win32/x64 onnxruntime. Runtime deps only: anthropic sdk,
  transformers, kokoro-js (everything else devDependencies).
- TESTER GUIDE (artifact): https://claude.ai/artifact/XQermrBPf5YRdWUUatoBck
  (install + Open Anyway, usage, Google opt-in, privacy, feedback questions).

## Remaining for beta (after design pass)
- Onboarding flow + trial countdown/paywall/founder code (Days 11-12 in plan)
- Final character art integration (swap procedural blob; single-clock juggle grip)
- Packaging: notarized DMG, bundle Whisper model, real app icon (Day 13)
- Apple Developer enrollment (BEFORE packaging — 24-48h lead)
- Beta distribution: privacy page, feedback form, welcome note (Day 14)
