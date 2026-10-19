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
- CHAT PROXY: proxy/ (Cloudflare Worker, 25 tests pass). DEPLOYED on her
  portfolio Cloudflare account (gayathri.swaminathan05@gmail.com) as
  companion-proxy → https://companion-proxy.companion-proxy.workers.dev
  (/health). KV "RATE" id in wrangler.toml. Secrets: APP_TOKEN (also in
  beta-config.json), ANTHROPIC_API_KEY (she pipes it in herself from
  userData/brain.key — key never passes through Claude). DAILY_LIMIT 60
  msgs/device. Redeploy: cd proxy && npx wrangler deploy. main.cjs: local brain.key wins;
  else electron/beta-config.json {proxyUrl, appToken} (GITIGNORED) → SDK
  baseURL=proxy + anonymous device-id. Daily limit 429 "daily_limit" → friendly
  nap message. Settings hides key row for proxy users.
- VOICE (on-device Kokoro-82M q8, subagent): electron/voice.cjs runs synthesis in
  a WORKER THREAD (in-process froze main 2.5-3s/line); src/voice.ts speak()/
  stopSpeaking()/setVoiceEnabled()/warmUpVoice(), sentence-chunked gapless
  playback, PLAYBACK_RATE 1.06. Model: repo models/onnx-community/Kokoro-82M-
  v1.0-ONNX (GITIGNORED, 4 files, 92MB) → bundled to Resources/models. Speaks
  reminders, meetings, nudges, jokes, welcome, new-mail SENDER only (never
  subject aloud), chat replies (header mute button). settings.voiceOn /
  voiceChat / voiceName (af_heart "Warm" default, af_bella "Bubbly", af_sky
  "Light"). Warm-up 8s after launch (~450MB RAM). Only speaks when visible.
  TODO idea: Whisper transcribe still runs in-process (same freeze pattern).
  CRASH FIX: Kokoro moved from worker THREAD to Electron utilityProcess
  ("Companion Voice") — two onnxruntime builds (kokoro 1.21 / whisper 1.24) in
  one process SIGSEGV'd in LoadModel. Quit = release Whisper then SIGKILL self
  (normal Node teardown SIGTRAP'd in ORT finalizers; saves are all sync).
- CLOUD VOICE (owner picked Google over on-device; liked Higgsfield "Dylan" but
  that can't run live): Google TTS Chirp 3 HD, accent per country (en-IN/US/GB/
  AU from app.getSystemLocale region, Settings "Accent" override), voices
  Puck/Fenrir/Charon/Leda/Aoede/Zephyr (default Puck). Proxy route /v1/tts
  (GOOGLE_TTS_KEY secret, TTS_DAILY_CHARS 6000/device/day, then on-device). Founder testing
  without proxy: userData/google-tts.key. main converts LINEAR16 WAV → Float32
  so playback path is shared; any failure falls back to Kokoro. Meeting titles
  + email senders ALWAYS on-device (say(..., {private:true})). NOT yet heard:
  needs her Google API key (enable Cloud Text-to-Speech API).
  BETA SHIPS WITH ON-DEVICE VOICE (owner, Oct 15): beta-config cloudVoice=false.
- WELCOME: first-run bubble (settings.welcomed).
- LUMIO CUT-OUTS (her own BG remover, ~/Desktop/Background remover, BiRefNet
  matting + foreground colour estimation): replaces chroma keying — no pink
  fringe/shadows. scripts/lumio_cutout.py (Lumio venv python; 12fps 540px;
  LUMIO_RES 1024 default, 768 fine) → scripts/lumio_match.py places new frames
  EXACTLY on the old frames' box (median scale/offset over 9 frames; keeps
  meta.json/manifest so in-app sizes don't move; refuses on frame-count
  mismatch). Batch driver: scripts/pipeline/recut-existing.sh clip:state; new clips: scripts/pipeline/sprite-in.sh <clip> <state>.
  Raw clips for her own tools: "Video assets for background removal/" (gitignored).
  Box = solid pieces >=2% of the biggest (shoes count, specks don't).
  LUMIO_MATCH=perframe for walk clips (stretching1-7 were CLIP_CROP=perframe).
  scripts/lumio_verify.py <state_dir> <old_frames> prints worst drift (px).
  NEW clips (no old frames): lumio_cutout.py → CLIP_PREKEYED_DIR=<cut> node
  scripts/process-clip.cjs <clip> <state>.
  DONE Oct 15: every state re-cut with Lumio (growth1-7, watering1-6,
  meeting1-6, grow transitions, stretching1-6, celebrating, coffee,
  thinking, listening, noting, sleeping, idle, idlehop, dragged, waving) +
  the 10 new clips. Drift ≤3px for static clips. grow4to5 needed
  LUMIO_MATCH=perframe (old frames were per-frame cropped; potScale back
  to 1.138). Old frames restorable via git (HEAD).
- PER-STAGE POSES (Oct 15, owner-approved, ~101 credits total): stills in
  mascot-poses/stage-poses/ (JOBS.txt has every still + video job id; white
  BG, gpt_image_2_5 high 1k = 1.5cr; two refs: stage-N plant + pose ref).
  celebrating1..7 (cork twist→pop→foam; trimmed 1.0–5.0s; 16fps oneshot;
  potScale = stage idle pot width ÷ clip start pot width), meeting7 (bell,
  0–4.2s), watering7 (short arm — she rejected the long-arm look; pour trim
  1.2–3.0s), stretching7 (walk7, 10s, perframe). Blob picks
  stageSprite("celebrating", stage). TASK ALARMS now ring the per-stage bell
  (set("meeting") + bell chirp) instead of waving (owner choice).
  Watering 1–6 still have the long-arm look; ~54cr to redo if she wants.
  BUNDLE B (Oct 15, owner: "be very careful with credits, priority order"):
  per-stage coffee (sip; also thinking/listening), sleeping (yawn → tip over
  → moon blanket → asleep, ONE clip, start = yawn still only, holdLast) and
  waving, for stages 1–3, 5–7 (stage 4 = the original clips). Stills in
  mascot-poses/stage-poses/bundleB/ (JOBS.txt = all ids + QA verdicts).
  Notepad stills were flawed → NO notepad videos (owner). Blob:
  stageVariant(prefix, stage) walks down to the nearest stage with frames
  (stage 4 → the unsuffixed clip). Sleeping clips get scripts/pipeline/feather_edges.py
  (28px alpha ramp) because the blanket runs off the frame. sleeping5–7 v1
  cropped flowers at the edge (plant too wide lying down) → RETAKEN (owner
  OK, 22.5cr) from yawn-stage{5,6,7}-padded.png (still shrunk to 68%, shifted
  right, "tips over toward the left, camera stays wide") → clips
  sleeping{5,6,7}b.mp4; v1 kept as sleeping{5,6,7}-v1-cropped.mp4.
  POSE SIZE MATCH: process-clip computes potScale for coffee/waving/
  sleeping{N} = growthN pot RIM ÷ clip-start rim (solid pot rows only, so
  arms/buds/flowers don't count); Blob scale = spriteScale(growthN) ×
  potScale (cap 1.8 for the 384px window). Coffee was already ±3%; wave
  +5–8% and yawn +8–13% are now fixed.
  HAMMOCK (owner pick: one rest pose for every stage, 54cr): stills + jobs in
  mascot-poses/stage-poses/hammock/ (refs stage-N + hammock.png), Kling
  start=end gentle sway → hammock1..7 (4 = original). REST ROTATION back in
  App.tsx: after ~12 quiet min on idle the plant lounges ~4 min in a rest
  pose that has art for its CURRENT stage (hammock all stages; lying/
  meditate/picnic/groove/hula only stage 4), any click/nudge/panel
  interrupts. Hula + picnic per stage = next when she buys credits.
  FIXES (free, on the PNGs — redo after any reprocess): hammock6 right post
  smeared by Kling in 5 frames → scripts/patch_static_region.py
  public/character/hammock6 290 326 (copies the static post band from f-001);
  original stage-4 hammock had white pockets between rope and posts →
  near-white opaque pixels cleared in all 61 frames.
  Balance 10.24 (Oct 15 late).
  HIGGSFIELD: the claude.ai connector works without /mcp (balance 273.9 →
  ~173 after this). gpt_image_2_5 rate-limits >4 parallel; Kling batch needs
  declined_preset_id 24bae836-2c4a-48e0-89b6-49fcc0b21612.
- PACKAGING: `npm run dist` = vite build → scripts/optimize-sprites.cjs (dist PNG
  → WebP q90 lossless-alpha, ~14% size, rewrites bundle paths) → electron-builder
  arm64 DMG, ad-hoc signed (identity "-"; signIgnore skips onnx/png/webp/json —
  osx-sign crashed on .onnx). Whisper base.en bundled to Resources/models
  (packaged app sets env.localModelPath/cacheDir). Excludes transformers
  .cache dup + linux/win32/x64 onnxruntime. Runtime deps only: anthropic sdk,
  transformers, kokoro-js (everything else devDependencies).
- TESTER GUIDE (artifact): https://claude.ai/artifact/XQermrBPf5YRdWUUatoBck
  (install + Open Anyway, usage, Google opt-in, privacy, feedback questions).

- OWNER BUG FIXES (Oct 16):
  1) CLICK HOP per stage: SPRITES.idlehop is the July pre-growth plant (no
     bud) → Blob now hops the stage's OWN idle loop with a CSS crouch →
     spring → squash landing (.growth-hop, like the drag swing). Real per-stage
     hop videos = ~7.5cr each later (start=end = stage-N still).
  2) STAGE-7 BELL lag: meeting7 clip froze 0.83s before ringing while the
     bell chirp fires at once → re-trimmed from meeting7-full.mp4 0.75–4.95s
     (old cut = meeting7-v1-leadin.mp4). NOTE: scratchpad lumio/new/<state>
     is a CACHE — delete it before re-cutting a re-trimmed clip.
  3) EDGE CROPPING: speech bubbles were always centred and tooltips only knew
     the window. Now: App sets --bubble-left/--bubble-tail (SpeechBubble
     slides inside the on-screen band, tail still points at the plant);
     src/edgeClip.ts EdgeClipContext → TooltipContent default collisionPadding
     = off-screen px + 6; toast centred in the visible band; clip re-measured
     after every drag, at launch and when any bubble/toast appears.
     (Top/bottom edge: panels/bubbles above the plant can still go off the
     top if the plant is dragged to the very top of the screen.)

- OWNER FIXES (Oct 16, round 2):
  JOKES: src/jokes.ts = the plant's joke book (314 wholesome Q→A riddles,
  dupes auto-dropped; no emoji, no stretched letters — TTS reads "moooon" as
  "mon"). tellJoke uses ONLY the book now (no Claude call); last 250 told are
  skipped (store caps jokeRecent at 250). Voice: punchline + "Ha ha ha!" is
  PREFETCHED (voice.ts prefetchSpeech cache) while the question shows, so it
  plays instantly on "What?". Name inputs in Settings left-aligned.
  COLOUR GROWTH ICONS: GrowthIcon = real plant thumbnail public/icons/
  stage-N.png (scripts/make-stage-icons.py from growthN f-001; re-run if
  growth art changes). Click hop stays CSS (owner: no hop videos).
  TOP EDGE: macOS clamps windows below the menu bar → plant couldn't go up
  (verified: y forced to 30). main.cjs enableLargerThanScreen:true + plantBox
  {top,height} from the renderer; clampPlantY keeps the PLANT on screen while
  the window may hang past edges; set-window-size shifts the window so the
  plant stays put; window-state.json saves plantTop/plantH. Renderer "flip":
  when panels don't fit above the plant (decideFlip on launch + drag end,
  hysteresis), plant sits at window top (FLIP_PAD 80) and menu (below its
  feet), panel stack (column-reverse), bubbles (.ui-flip CSS, tail up) and
  toast open BELOW. relayout hides the UI ~2 frames during the shift.
  RadialMenu now takes real winW/plantTop/plantBottom (was hardcoded 384x600;
  MENU_GAP 81 = same look as before). Gallery has top-of-screen examples.

## Onboarding + landing — DECISIONS (Oct 15, discussed, NOT built; she said
## "do not start building" until she confirms)
- NAMES: she will pick a new app name + plant default name (replaces
  "Companion"/"Blob" on landing, installer, onboarding). Wait for them.
- ONBOARDING: plant talks you through it on the desktop (speech bubbles, one
  question at a time, Finch-style, "Skip setup" always visible, ~2 min,
  scripted not AI, spoken aloud + mutable, no pricing). Proposed steps: hello
  wave → your name / its name (+Shuffle) → "drag me anywhere" (wait for drag)
  → "click me" (menu) → first reminder by typing or mic (mic permission asked
  only here) → care card (stretch/water/bedtime defaults) → start at login →
  growth explainer. Privacy line: "I notice when you step away, never what
  you type." Permissions in context only.
- LANDING: simple private (unlisted) beta page on her Cloudflare (Pages +
  DMG on R2): hero = headline + Download for Mac + plant animated on a Mac
  desktop mock; 3-step install incl. Open Anyway; what it does; privacy;
  feedback. Refs: Tana / Grain download heroes, Finch setup flow (Mobbin).
- FEEDBACK: short form (Google/Tally) linked from page AND an in-app menu
  button (+ one gentle day-5 ask, counts toward the 4-nudge cap).
- WIREFRAMES (Design canvas artifact, private): https://claude.ai/artifact/PTD5iYxQVt6jzmAi5DEPVz
  — landing page + onboarding steps 1–9 + feedback button. SAVED COPY in
  docs/wireframes/ (boards + snapshots PNGs), Oct 16.

## Landing page v2 + trailer (Oct 15, wireframes only — nothing built)
- Canvas https://claude.ai/artifact/PTD5iYxQVt6jzmAi5DEPVz rows: landing v1,
  onboarding 1–9, feedback, Trailer (look + 9-shot storyboard), Landing v2:
  hero Option A playful desk / Option B busy WORK desk (owner leaning B:
  "show the busy-ness"), intro sequence (watering loader → plant says hi,
  "Say hi back 🔊" unlocks sound → "try the phone!" → auto-scroll to videos
  with polite rules), use-case video chapters (sticky video + 6 chapters),
  phone version ("Send this to my Mac" share sheet). Inspired by
  play.jegteixeira.com (pannable desk, interactive objects). Every desk
  object = a feature that plays the real plant animation + sound.
- Trailer pipeline + approved test shot: marketing/trailer/ (SHOTLIST.md).
  ALL 8 SHOTS DONE (Oct 15): shots/01-struggle, 04-hello, 05-stretch-v2,
  06a-water, 06b-email, 07-callmom, 08-win, 09-goodnight (.mp4 with audio).
  compose_shot.py = virtual camera (log-zoom push-in onto the plant, screens
  replaced from green with captured HTML at @4x, occluders kept, green
  spill filled before blur); audio/mix_shot.py = room tone + typing + the
  app's own chirps + Kokoro VO (plant af_heart, "Hi Ma!" am_michael).
  09 re-rendered with the STAGE-7 sleeping plant (continuity: 08 ends in
  full bloom); stage-4 version kept as 09-goodnight-stage4.mp4. Plant growth
  across the day: hello/stretch/water/email = 4, call mom = 5, win/night = 7.
  Pending: background music; full 60s cut + per-section landing videos.
- LANDING v3 (owner's current direction, Oct 15): SIMPLE story narrative.
  Hero = the plant introduces itself (big plant, speech bubble, "Say hi
  back 🔊"), then auto-scrolls (politely) into 8 sections, morning → night,
  each = use-case video one side + copy the other (alternating), section
  backgrounds darken with the time of day; ends "You're not alone at your
  desk." + Download. Canvas row "Landing page v3"; stretch test video is
  embedded in its section. Phone: stacked, vertical 9:16 videos, "Send this
  to my Mac". v1 and v2 kept for comparison.
- Owner preference: keep ALL design options side by side (never overwrite).

## Beta landing / download page — BUILT (Oct 16, owner: "complete landing page/app download page")
- site/ (static: index.html, styles.css, main.js, assets/). Preview: launch.json
  "beta-site" → http://localhost:8790. Old July waitlist page stays in landing/.
- SETTINGS: top of site/main.js → SITE { appName ("Companion" until she names
  it), downloadUrl (.dmg on R2, empty = dimmed button + "opens with the
  beta"), feedbackUrl (empty = "Form coming soon") }. Plant never says a name
  ("your little desk plant") so her naming doesn't block the page.
- Follows wireframe v3 + grid: hero (plant stage 5 breathing, typed bubble, "Say
  hi back" = Kokoro af_heart voice line assets/audio/hello.m4a + wave anim,
  then glides to the story; polite idle auto-glide after 6.5s, cancelled by
  any scroll/tap/key, off for reduced motion) → 7 story chapters with trailer
  shots (9am→9:30pm; videos lazy-load,
  play in view, sound toggle: once on, each chapter speaks as it scrolls in)
  → NEW GROWTH section (owner ask: show how the plant flourishes): 9:45pm
  "Look how much we grew today", interactive: I stretched +2 / I drank water
  +2 / I finished a timed task +1 → real stage animations 1→7, meter, 7-stage
  strip, app chirps, confetti at full bloom, "Start a new day" → goodnight
  → download (bloom wave, install-3-steps incl. Open Anyway, privacy, feedback;
  phones get "Send this to my Mac" share). noindex (private link).
- LOOK (owner, Oct 16): WHITE page with a fine grid mesh like the playground
  ref play.jegteixeira.com (body bg: 1px lines rgb(32 29 47/.065) every 44px)
  + a faint blurred window-frame shadow in the hero (daylight on the desk,
  hidden on phones). No coloured/dark section backgrounds any more: cards are
  white with soft shadows; only the time labels change colour through the day.
  Desktop QA: offscreen Electron capture (sections at 1440x900) when the
  preview pane is too narrow.
- HERO v2 (owner, Oct 16): plant WALKS in from the left edge (CSS waddle on
  the stage-5 breathing loop: rotate/bob steps, 3.1s ease, landing squish;
  no walk video, ~9cr if ever wanted), bubble pops, plant speaks + types
  "…Will you say hi back?". No hi within 2.5s after it finishes → CTA
  JITTERS + "Hellooo? I'm waiting for your hi!" (then quiet jitter every 6s,
  max 4). Big glowing "Say hi back" CTA. After hi: "Yaaay, hi!" reply, then
  the STORY TOUR starts (no auto-scroll before the hi).
- VOICE: owner picked sample D = Kokoro af_heart "bubbly" (pitch +2.5 semitones
  via asetrate+atempo, speed 1.05) — the same sound is meant for the app later.
  scripts/site/build-voice.sh [voice] builds intro/nudge/reply + tour-1..10.
  Samples A–D in marketing/voice-samples/.
- STORY TOUR (owner: "scroll automatically… as if the plant is narrating"):
  runTour() scrolls section by section (chapters/growth card centred,
  download from top), plant narrates each (tour-N.m4a + caption chip
  bottom-left whose avatar grows 1→7 through the day), videos stay muted
  while it narrates, growth section auto-grows to full bloom. Visitor
  wheel/swipe/keys/in-page link → pauses; "Continue the story" resumes from
  the section on screen. ~80s total. Skipped for reduced motion.
- SAY HI FOR REAL (owner): "Say hi back" opens the mic and the plant listens
  ("I'm listening! Say hi!"); a short burst of voice above the room-noise
  floor = hi (loudness only, in the browser: nothing recorded or sent, no
  speech service). Then "Yaaay, hi!" and the tour starts by itself. 9s of
  silence → "can't hear you" line; no mic/denied → button becomes "Wave hi";
  "No mic? Wave instead" link always there.
- DOODLES v2 (owner refs: duotone desk illustration / ink sketch / line-art
  grid; "fun but minimalistic"): hand-drawn SVG illustrations in
  site/doodles.js (window.DOODLES, filled into [data-doodle] by main.js):
  indigo line #3f33a6 + lavender/coral/butter fills, moving parts (steam,
  buzzing phone, ticking clock, floating notes, dripping water, twinkles,
  laptop blink). Hero: ~10 around the plant (sad laptop, calendar, coffee,
  sticky checklist, lamp, phone, headphones…; inner ones hide <1240px, all
  hide <900px). ONE per section in a top corner (papers, plane, clock,
  water, envelope, phone, popper, can, headphones, moon) and the laptop is
  HAPPY at the download (sad→happy arc). Wiggle on hover.
- CHILL v2 (owner: cards looked merged): 3 distinct cards with label chips —
  Chat (white, app-style window with "Your plant · online"), Jokes (butter
  sticky note, tape, tilted; card FLIPS to a lavender punchline + "ha ha ha!",
  giggle chirp, "Another one"), Chill (sky gradient, hammock + sparkle).
  3 columns ≥1100px, 2 mid, stacked on phones (no tilt).
- CHILL SECTION (owner: the chat use case was missing): after growth, "Or
  just chill with me." 10:15pm: app-style chat that plays out (vent + "remind
  me to call mom at 6" → task), joke card (10 jokes from the joke book, What?
  → punchline), hammock card (hammock-7.webp). Tour step 9 narrates it
  (tour lines now 1–11).
- ONE SOUND SWITCH (owner): bottom-right dock "Sound on/off" governs plant
  voice, chirps and story videos (per-video buttons removed). Off by default
  (browsers block sound); the intro turns it on if the browser lets it play,
  otherwise the switch gets an attention ring; "Say hi back" turns it on.
- Flow QA: hidden-window Electron run logs every step (scratchpad herotest).
- MEDIA (re-run when art/shots change): scripts/site/build-media.py <ffmpeg>
  [icons|plants|videos] (720p crf26 videos ~0.7-1.2MB + posters, animated
  WebP plants 300px: idles every 2nd frame @6fps ~700KB), scripts/site/
  build-icons.mjs (Phosphor → assets/icons.svg sprite). Fonts self-hosted.
- NOT DONE (needs her): final names, feedback form, upload DMG (release/
  Companion-0.1.0-arm64.dmg is OLD, rebuild with npm run dist first) and
  deploy (Cloudflare Pages + R2) — publishing needs her OK + her login.

## Landing VERSION B (Oct 16, owner: "another version like Tolan") — site/b.html
- Kept SIDE BY SIDE with version A (index.html, narrated story). B = Tolan
  pattern, plain manual scroll: giant wordmark hero (NO doodles — owner) with
  BIG plants PERCHED on it (coffee sip top-left, wave top-right, asleep under
  its blanket at the end) + Watch the trailer / Download. TRAILER = small
  card fixed bottom-right (silent preview loop trailer-preview.mp4, 9s,
  340KB; ✕ hides it for the session; phones show it only after scrolling
  past the hero buttons) → click / "Watch the trailer" EXPANDS into a modal
  player with sound (Esc/backdrop/✕ close, closes itself at the end).
  TRAILER SOUND v2 (owner: old merge "sounded very robotic"): the PLANT
  NARRATES it in voice D — marketing/trailer/audio/narrate.sh → narr-1..8.wav
  (one line per scene), beds = mix_shot.py re-run WITHOUT the old --vo lines
  (bed-*.wav: room tone, foley, app chirps), build-trailer.py mixes beds +
  narration (bed ducks under the voice) over the -silent.mp4 scenes, black
  fades. 47s, 9MB. Use-case groups with the
  plant's OWN animations (no person videos) + a mock of the real app bubble:
  Looks after you (stretch, water), Keeps you on time (bell reminder, email),
  Celebrates and grows (champagne + interactive growth), Hangs out (chat /
  jokes / hammock cards from A), Says goodnight (sleep) → privacy grid (copy
  from wireframe v1) → download + install + feedback. Files: b.html, b.css
  (on top of styles.css), b.js (own SITE block — keep in sync with main.js).
  Feature anims: build-media.py "features" (feat-stretch = stretching5 frames
  1–56 only, feat-water/bell/coffee/cheers/sleep; -still/-end variants).

## Settings "How I work" (Oct 16, owner: show how the plant works)
- SettingsPanel top: TODAY card (colour plant, "Stage N of 7 · P of 12 points",
  green→pink progress bar, 7 stage icons, next-step hint, week stats) +
  collapsible HOW I WORK guide (open by default): grow rules, gentle nudges,
  reminders, chat + memories, jokes, bedtime, moving me — sentences use her
  real settings (break/water minutes, bedtime, joke frequency, calls).
  App passes points = today's sprout points.

## Privacy round (Oct 16, owner: "hide email, I want to be 100% sure")
- EMAIL HIDDEN (cost: gmail.metadata = Google "restricted" scope → paid
  security assessment): src/features.ts FEATURES.gmailAlerts=false +
  calendar.cjs GMAIL_FEATURE=false (Google sign-in asks calendar.events
  only; Gmail poller never starts). Settings: Gmail row hidden, section
  "Google Calendar", reconnect ignores gmail. Flip both flags to bring back.
  STILL TODO: email chapter/card in landing A + B, trailer scene 06b-email
  + narr-5, "47 sec" labels.
- CHAT WITH AI SWITCH: settings.chatOn (default on). Off → ChatPanel shows
  "Chat is off" + Turn chat on; App.sendChat returns early; main.cjs
  chat-send/brain-once also refuse (chatAllowed() reads the saved file =
  second lock). Settings → Privacy row + corrected note (old note wrongly
  said "never stored"): not used for training, deleted within 30 days
  (Anthropic commercial API default; flagged = up to 2y).
- ZERO DATA RETENTION prep: Anthropic ZDR = request via claude.com/contact-sales,
  per ORGANIZATION, approval case by case. web_search_20260209 defaults to
  dynamic filtering (runs in code execution = NOT ZDR-eligible, kept up to
  30d) → main.cjs now sets allowed_callers:["direct"] (tested: search works).
  Everything else we use (Messages, streaming, prompt caching, direct web
  search) is ZDR-eligible. Don't add code execution / Files / Batch / web
  fetch dynamic filtering. After approval: update privacy copy in app +
  landing to "not stored after the reply".

## CHATGPT SWITCH (Oct 16, owner: leave the COMPANY Claude account → her own OpenAI account)
- Both AIs supported; the KEY decides: userData/brain.key starting "sk-ant-"
  = Claude, anything else = ChatGPT. Proxy builds: beta-config.json
  "provider": "openai" | "anthropic" (default anthropic — flip ONLY after
  OPENAI_API_KEY is on the proxy + redeploy, or testers' chat breaks).
- main.cjs: brainProvider()/getBrain() → {provider, client}; chatOpenAI =
  Responses API stream, model OPENAI_CHAT_MODEL "gpt-6.1-sol" (balanced tier
  $2/$10 per 1M; budget "gpt-6-luna" $0.10/$0.50), instructions = joined
  brain.ts blocks, tools [{type:"web_search", user_location approx country +
  timezone}], reasoning effort low, max_output_tokens 4096, store:false,
  prompt_cache_key "companion-chat"; sources from url_citation annotations.
  chatClaude = old loop. brain-once both. OpenAI lib "openai" 7.34 (runtime dep).
- Proxy: /v1/responses → api.openai.com (Bearer OPENAI_API_KEY secret);
  OPENAI_ALLOWED_MODELS, OPENAI_OUTPUT_CAP vars; forces store:false; only
  web_search tool; blocks previous_response_id/conversation/background;
  shares the daily counter with Claude. 31 tests pass (6 new, incl. real
  OpenAI SDK stream). NOT DEPLOYED yet (needs her OK + her secret).
- UI: aiName ("ChatGPT"/"Claude" from brain-status provider) in Settings key
  row, Privacy row + note, chat-off screen; connect screen = OpenAI steps
  (platform.openai.com/api-keys, "a ChatGPT Plus plan doesn't include one").
  Out-of-credit message matches OpenAI "quota/billing" too.
- PERSONALITY CHECK: scripts/chat-eval.mjs (20 chats: voice, length, no bot
  phrases/hotline-for-sadness, crisis line, task/complete/remember/meeting
  tags + exact due times, research format). Uses the saved key; MODEL=…
  to compare; DRY=1 = no calls. Run it as soon as her OpenAI key is in,
  then tune brain.ts wording (keep PERSONALITY byte-stable between runs).
- After the switch: she deletes the company key (company console) and the
  proxy's ANTHROPIC_API_KEY (npx wrangler secret delete ANTHROPIC_API_KEY).
  ZDR request now goes to OpenAI (same idea, their sales team).

## HANDOVER TO CODEX (Oct 16) — owner moving to her own ChatGPT/Codex
- AGENTS.md (repo root) = instructions for Codex/any agent; points here.
- Helper tools rescued from the Claude session scratchpad into the repo:
  scripts/pipeline/ (sprite-in.sh, recut-existing.sh, conveyor.sh,
  feather_edges.py, potsize.py, sbs.py, strip.sh), scripts/site/qa/
  (capture-version-b.cjs, hero-flow.cjs, render-wireframes.cjs),
  marketing/trailer/rebuild.sh (exact shot/bed/narration/trailer settings).
- claude.ai pages saved: docs/wireframes/ (Design canvas boards, assets,
  snapshots) and docs/tester-guide/ (live HTML + source).
- Higgsfield was used via a claude.ai connector; Codex needs its own
  connection (or she generates on the Higgsfield site; clips go in
  assets/clips/ then scripts/pipeline/sprite-in.sh).

## TESTING TOOLS IN THE APP — REMOVE BEFORE PUBLIC LAUNCH (owner, Oct 16)
Owner's own testing aids; they stay through the beta, then go.
1. GROWTH TEST BAR (src/ui/GrowthTestBar.tsx, rendered in App.tsx): strip
   beside the plant to jump growth stages 1-7 and replay level-ups/watering.
   Development app only (hidden when isPackaged), can be hidden via its chip.
2. DEBUG MENU (DebugMenu in App.tsx): right-click the plant → any pose,
   test nudges/jokes, sounds, growth stage. Development app only.
3. SHOWCASE (src/ui/Showcase.tsx): the secret ✦ dot at the LEFT END of the
   menu bar → plays any animation (also used to record marketing clips).
   NOT dev-only: it is in the testers' installer too.
At public launch: delete or dev-gate all three (and settings.growthTestVisible),
re-check that nothing else is reachable only for testing.

## Remaining for beta (after design pass)
- Onboarding flow + trial countdown/paywall/founder code (Days 11-12 in plan)
- Final character art integration (swap procedural blob; single-clock juggle grip)
- Packaging: notarized DMG, bundle Whisper model, real app icon (Day 13)
- Apple Developer enrollment (BEFORE packaging — 24-48h lead)
- Beta distribution: privacy page, feedback form, welcome note (Day 14)

## CODEX HEALTH CHECK (Oct 16, 2026) — step 1
- Read AGENTS.md and this entire memory before work. Owner wants steps 1–7
  handled in order, with a check-in after each; this session covered step 1 only.
- Started clean on ui-refresh-shadcn. Read-only GitHub branch lookup confirmed
  local HEAD and GitHub both at 7820b000bc721046350944a4f2a6ab02287c22bd.
- `npx vite build` passed (7.33s). Non-blocking warnings: large JS bundle and
  time spent preparing the output directory. No application code changed.
- `cd proxy && npm test`: all 31 tests passed, including simulated OpenAI
  streaming, privacy and daily-limit checks. No paid AI requests made.
- Restarted the existing development Electron app with the fresh build;
  native UI confirmed the Companion window loaded dist/index.html.
- Asked once whether the secret Showcase should stay visible to beta testers;
  answer pending at this checkpoint. All testing tools remain unchanged.
- Next: owner enters her OpenAI key in Settings → My brain key → Change key,
  then confirms readiness for the live personality check. No deployment, push,
  installer rebuild, paid AI calls or later steps performed. This memory entry
  is the only local tracked change after the health check.

## LANDING OPTIONS PREVIEW (Oct 16, 2026)
- Owner asked to see both existing Claude-built landing options while step 2
  waits for her key. Started a local-only preview at http://127.0.0.1:8790
  using Python's HTTP server (bound to loopback).
- Open requests queued in Codex for index.html (A, narrated story) and b.html
  (B, Tolan-style wordmark + trailer). Both URLs returned HTTP 200.
- No landing files changed or published. Email removal remains planned for
  step 6; these previews still show the existing email content.

## CHAT PRIVACY REVIEW (Oct 16, 2026) — owner asked before key/testing
- Read-only source review, not a full security audit or live server/settings
  verification. No paid requests, deployment or application changes.
- Testers do not need personal AI keys: their build can use the server-held
  owner's key. Local beta-config currently defaults to anthropic, cloudVoice
  is false. Adding an OpenAI key to the owner's Mac does not migrate testers.
- IMPORTANT correction to earlier shorthand: store:false disables stored
  Responses retrieval; it does NOT establish Zero Data Retention. Official
  OpenAI data-controls docs (https://developers.openai.com/api/docs/guides/your-data)
  say API content is not used for training by default, abuse-monitoring content
  can remain up to 30 days (longer for stated legal/safety exceptions), and
  prompt caches have separate retention. ZDR needs approval and a check of
  the actual account, model and feature eligibility. No approval verified.
- IMPORTANT product-promise mismatch: src/brain.ts buildSystem sends the
  user's name, plant progress, up to 8 open task texts, all tasks completed
  today, saved facts and any summary with chat; buildMessages sends the last
  16 messages. Thus tasks/memories are stored locally but not exclusively
  processed locally while chat is on. Landing B's "live only on your Mac"
  and "only chats" wording is incomplete; Settings' guaranteed deletion
  "within 30 days" is too absolute. Recommend minimizing shared context and
  clear opt-in disclosure before broader testing (chat currently defaults on).
- Proxy code does not log/store chat content; stores device/day counters for
  ~2 days, observability disabled in local wrangler.toml. Cloudflare still
  processes relayed chat; this is not end-to-end encrypted against processors.
- Local chat history/facts are plain JSON, without app-level encryption.
  Chat-history deletion leaves facts; local deletion does not erase provider
  logs. Fetched Google Calendar events are excluded from the chat prompt;
  information a user types into chat is still sent normally.
- Beta transcription and speaking voice run locally. Optional Google cloud
  TTS exists and can send spoken text even with AI chat off if enabled; keep
  it disabled under the present promise and review before enabling it.
- Chat-off guards prevent new AI requests, not removal of previously sent
  content or guaranteed cancellation of an already-running request.
- Original steps 2–7 remain pending; owner is discussing privacy first.

## PUBLIC CHAT COST DISCUSSION (Oct 16, 2026)
- Owner asks how public rollout avoids a large AI bill. No model/plan changes
  or paid API calls authorized by this discussion; no public rollout started.
- Checked current official OpenAI model/pricing pages: standard short-context
  gpt-6.1-sol $2 input/$10 output per million tokens; gpt-6-luna $0.10/$0.50.
  Web search $10/1,000 calls plus search-content tokens. Cache reads/writes
  have separate prices. Sources: developers.openai.com/api/docs/models/
  gpt-6.1-sol, /gpt-6-luna and developers.openai.com/api/docs/pricing.
- Illustrative calculation only (NOT measured app costs): 3,000 input + 300
  total billed output tokens including reasoning per reply, ordinary input
  pricing, 20 replies/day × 30 days. Sol $5.40/user/month; Luna $0.27.
  100 users: $540/$27; 1,000: $5,400/$270. Excludes search, cache effects,
  hosting, payments, taxes, and retries. Actual usage must be measured.
- Recommended direction: keep local features free; small capped AI trial/free
  allowance; paid capped chat; compare cheaper model's personality/actions
  before selecting; separate research allowance; reliable server-enforced
  per-user limits and global cost cutoff before public release. Count usage
  without logging conversations. Recommendations are not approved pricing.
- Found public-readiness issue: current proxy counter fails open on KV errors,
  updates are non-atomic, device IDs are client-generated and app token is
  shared. The beta's 60/day setting is not a reliable public cost ceiling.
- Old plans conflict: this memory says $4.99, PRD §12 says $6.99/$49.99 yearly
  with "unlimited" and 100/day fair use. Do not treat old margins or pricing
  as validated for OpenAI or promise unlimited usage before measuring costs.

## TOLAN RESEARCH (Oct 16, 2026) — context, not a product decision
- Owner supplied a summary of Tolan's models, costs, tiers and routing. Checked
  sources instead of treating all supplied numbers as established facts.
- OpenAI Jan 7, 2026 case study (https://openai.com/index/tolan/) confirms
  GPT-5.1, text-embedding-3-large, Turbopuffer and per-turn selected memory/
  tone context. It describes tone adaptation, but does not establish the
  claimed cost-routing system, 5x price ratio or one-third offload figure.
- Tolan founder's Feb 25, 2025 post confirms late-2024 soft launch:
  https://www.tolans.com/relay/introducing-tolan . Did not verify the claim
  that costs forced a subscription pivot after exactly two weeks, or that
  a heavy user's underlying model usage costs $200/month.
- US App Store listing id6477549878 currently lists Lite $11.99 and Plus
  $24.99 alongside old plans, WITHOUT billing periods. Reviews mention
  $200/month unlimited; not independently confirmed as current official
  pricing or matched to an underlying cost. Do not call these confirmed
  monthly plan prices. Official FAQ says limited trial then subscription;
  Membership screen is needed for exact current plans and allowances.
- GeekWire Jul 7, 2025 attributes >100,000 paid users and >$1m/month revenue
  to CEO Quinten Farmer. Historical reported revenue, not current audited
  results or profit. Source: https://www.geekwire.com/2025/ai-companionship-app-tolan-raises-20m-to-help-more-people-grow-with-a-virtual-alien-friend/
- Privacy distinction: https://www.tolans.com/faq explicitly says they log
  conversations on their servers for memory. Do not adopt that architecture
  under this project's local-memory promise. Local memory selection and
  measured model comparisons are possible without a cloud memory database.
- No app changes, paid tests, pricing commitments or deployments made.

## PRODUCT FOCUS RESEARCH (Oct 16, 2026) — proposal, NOT approved direction
- Owner asked whether chat, wellness or productivity should be the USP, and
  whether affirmations, emotional check-ins and gossip should shape chat.
- Recommendation to TEST: a gentle Mac workday companion for adult desk
  workers. Proposed promise: "A little desk plant that helps you get things
  done and look after yourself." Plant presence/personality is the emotional
  hook; small tasks + breaks provide recurring usefulness; growth rewards
  self-care; optional AI adds help starting, encouragement and playful company.
  This is a product hypothesis, not proof of uniqueness, retention or demand.
- Official competitor research: Finch already combines self-care and pet
  growth (https://finchcare.com/about-finch); LookAway offers Mac break nudges
  and interruption controls (https://lookaway.com/press-kit/); Focus Friend
  gamifies focus (https://www.yourfocusfriend.com/); Structured offers daily
  planning and AI (https://structured.app/). Do not claim these individual
  features or "pet grows through self-care" are unique. Differentiate through
  the specific desktop workday experience and execution, then validate.
- Evidence: 2022 microbreak meta-analysis, 22 samples / 2,335 participants,
  found small improvements in vigor/fatigue but no significant overall
  performance improvement: https://pubmed.ncbi.nlm.nih.gov/36044424/ . Supports
  a modest break/wellbeing rationale, not an app-specific productivity claim.
- AI companionship evidence is mixed/limited: De Freitas et al., Journal of
  Consumer Research (2025 advance publication), found momentary loneliness
  reductions, including across a week; feeling heard mattered. Author copy:
  https://www.hbs.edu/ris/Publication%20Files/AI%20Companions%20Reduce%20Loneliness%2011.7.2025_57451c02-8047-4e0d-abfc-55841f64166d.pdf
  Fang et al. 4-week study, N=981, v2 Oct 2025 preprint found no significant
  effects of assigned conditions; higher voluntary use was associated with
  worse psychosocial outcomes, NOT proof that usage caused them:
  https://arxiv.org/abs/2503.17473 . Do not market treatment of loneliness,
  anxiety or depression or optimize for endless conversation time.
- Recommend optional everyday energy/needs check-in, not a mental-health
  assessment: no diagnosis, clinical scoring, inferred conditions or automatic
  sensitive memory. Local choices can offer quiet company, a break or a small
  next task without an AI call. Serious-distress responses need separate
  review/testing; a disclaimer alone does not enforce nonclinical behavior.
- Affirmations: prefer optional believable encouragement to sweeping positive
  claims. Wood et al. 2009 found one positive self-statement could backfire
  for low-self-esteem participants; this does not establish all affirmations
  are harmful: https://pubmed.ncbi.nlm.nih.gov/19493324/ . Curated local lines
  can provide this feature with no per-message model cost.
- Concrete proposed personality correction (NOT applied): src/brain.ts says
  "take their side instantly" and "keep secrets like a vault". Recommend
  validating feelings without inventing other people's motives or endorsing
  every judgment, and removing absolute secrecy language. Cheng et al.,
  Science 2026, experiments N=2,405 found overly agreeable AI reduced desire
  to repair conflicts while increasing confidence users were right:
  https://pubmed.ncbi.nlm.nih.gov/41886588/ . Keep humor/banter, soften for distress.
- Proposed presentation changes: lead landing demo with task -> care break ->
  growth; show optional chat later. Preserve both existing A/B designs. Keep
  task list lightweight, nudges controllable, no guilt or suffering pet, and
  core usefulness with AI off. Privacy/context issues recorded above remain
  prerequisites; no new analytics or cloud mood history proposed.
- Proposed validation: 10–15 adult Mac desk workers for two weeks, voluntary
  interviews and user-shared local information, no transcript collection or
  hidden analytics. Assess repeat usefulness, annoyance, what they would miss
  and willingness to pay; compare workday vs chat concept messages. Small
  directional test, not statistical validation. No prices or plans decided.
- Research and memory update only. No app/landing edits, new onboarding,
  paid calls, publishing or deployment. Original live chat test awaits owner.

## WORKDAY OPTIONS + BREATHING (Oct 16, 2026) — owner approved implementation
- Owner approved new A.2.0/B.2.0 landing options AND chat tone/starters, then
  requested guided breathing using the existing meditation animation.
- New side-by-side pages: site/a2.html + a2.js, site/b2.html + b2.js, shared
  v2.css/v2.js. Originals index.html/main.js and b.html/b.js remain unchanged.
  A2 keeps the narrated workday story; B2 keeps the giant wordmark/cards.
  Tasks, care breaks and growth lead; optional chat comes later. Both add
  breathing and four-option comparison navigation. Removed email from NEW
  options, corrected optional-chat/context privacy wording. B2 omits the old
  trailer because it still contains email. Original-page/trailer cleanup is
  still pending; no new narration generated. A2 tour has 11 steps, with
  original audio reused only where the caption is unchanged.
- Meditation WebPs in site/assets/plant derived locally from existing PNGs;
  reduced-motion still on the pages. No AI generation or credits used.
- src/brain.ts: warm/loud/funny, short practical support, optional believable
  encouragement, no automatic side-taking or absolute secrecy promise, no
  clinical assessment/treatment or dependency language. Original prompt kept
  in docs/personality/2026-10-16-original.md. Action tags preserved. Existing
  serious-distress behavior still needs separate live review; not validated.
- ChatPanel starters: Help me start / I need a breather / Just chatting.
  Clicking fills a draft and focuses the input; it never sends automatically.
- Breathe menu entry + src/ui/BreathingPanel.tsx + src/breathing.ts: optional
  60-second LOCAL session (settle, gentle 4s in/4s out, natural breathing),
  no holds; own pace, pause/resume, stop, repeat. Pauses for reminders, hidden
  window or suspension. Existing meditation pose plays while active. Text
  guidance only, no spoken narration yet. One stage-4 pose reused at all
  stages, not new per-stage art. No AI/network calls, stored mood information,
  analytics, new settings or growth points. Reduced motion stops cue scaling.
- Fixed stretch setting Never (0) incorrectly satisfying the due condition.
  Suggested next wellness work, NOT implemented: snooze/pause-care controls,
  fair rotation of water/stretch under shared cap, bedtime cap review and
  optional quiet hours. Preserve gentle opt-in behavior.
- Validation: vite build passed; proxy 31/31 passed; DRY personality setup
  passed (20 cases; saved provider still Claude). No live paid AI evaluation.
  scripts/test-breathing.mjs phase boundaries passed; gallery interaction QA
  passed draft-only starters, chat-off, start/inhale/pause/own pace/full real
  minute/restart. Both landing versions passed desktop1440/phone390/narrow320
  layout and interactions. Reports/screenshots: docs/qa/2026-10-16/.
- Applied local animate skill for breathing cue and reduced-motion behavior.
  All beta testing aids retained. No commit/push/deploy/installer rebuild.
- Testing tool research: free local Lighthouse and axe first; Attention
  Insight predicts attention without participants (not actual comprehension);
  Synthetic Users simulates feedback, cannot replace lived user experience.
  Lyssna five-second/first-click tests and Maze moderated studies use real
  participants. No accounts, uploads, analytics or paid tools activated.
  Sources: developer.chrome.com/docs/lighthouse/overview,
  deque.com/axe/devtools/extension/, attentioninsight.com/technology/,
  legal.syntheticusers.com/ai/safety-bias-controls,
  lyssna.com/features/five-second-testing-software/.

## DUPLICATE APP / REOPENING REPORT (Oct 16, 2026)
- Owner saw two apps: installed older release/mac-arm64/Companion.app and
  current development Electron (loads repo dist/index.html). Closed older
  copy. Native getApp can launch a stopped app, so avoid selecting Companion
  just to inspect it; use existing Electron binding/process inspection.
- Owner then reported repeated opening/closing. At inspection neither app
  process was running. Previous development command ended SIGKILL, which is
  also this project's intentional normal-quit path; not proof of a crash.
- Launched current built app ONCE with npx electron ., verified one process
  and visible latest plant. No test harness processes or restart loop running.
  Earlier QA opened/closed Electron test windows and may explain the report;
  cause not established. Asked whether whole plant or just menu flickered.
  Keep the latest app open and avoid further QA launches while she tests.
- Follow-up: same process stayed alive for nearly two minutes, no terminal
  errors, native window still visible. No code changes made for this report;
  repeated closing not reproduced after the single launch.

## SPOKEN MEDITATION CORRECTION (Oct 16, 2026)
- Owner clarified meditation was meant to be VOICE guided with the plant in
  its meditation pose, not just on-screen cues. Implemented bundled spoken
  one-minute guided and own-pace tracks, using the existing local Kokoro
  af_heart voice at speed 0.92 with quiet gaps. No live AI or cloud voice.
- public/audio/meditation-{guided,ownPace}-v1.m4a plus cue metadata; generated
  with scripts/build-breathing-audio.mjs (local models only, remote fetching
  explicitly blocked). Script refuses to overwrite an existing take. Entire
  guide adds about 300KB. No credits, API calls or new service dependencies.
- BreathingPanel now uses audio playback time as its clock, so captions and
  breath cues remain synchronized. Pause/resume, Stop, close/switch panel,
  visibility change, interruptions and suspension stop/pause audio; failed
  playback shows a retry message. Voice-guide toggle allows quiet mode and
  respects Settings voice-off with explanatory text. Own-pace mode changes
  while paused. The guide is a fixed warm voice, not a live settings-voice
  synthesis. Plant takes meditation pose on opening and keeps it through
  pauses/completion until closed or interrupted. Active Breathe nav no longer
  resets its pose. Existing stage-4 meditation art still reused at all stages.
- New A2/B2 breathing copy now explicitly describes spoken guidance. Original
  landing options still untouched. No background music added.
- Build and timeline/script consistency checks passed; decoded both tracks
  are 60.03s with non-silent voice at every cue and no overlaps. Full playback
  interaction QA is recorded below after completion. No publishing/pushing.
- Full muted Electron QA passed: real media playback, inhale synchronization,
  pause freezes audio/time, own-pace resume, live mute, full minute completion,
  restart and Stop. Report: docs/qa/2026-10-16/app-checks.txt. Updated app
  launched once; native UI confirmed meditation pose and Voice guide checked.
  Left Breathe panel ready on Start one minute for Gayathri to listen herself.
- Owner reported no voice, clarified only meditation pose appeared. Inspected
  actual app: Voice guide checked, Start enabled. Native click on Start one
  minute successfully began playback, switched to Pause, and advanced to
  43 seconds / Breathe out gently. Mac default output is built-in speakers.
  Asked owner whether she can hear this actual run; do not assume an audible
  success solely from the timer or earlier muted QA. No speculative code fix.
- Gayathri confirmed: "Yes, I can hear it now" after the actual desktop
  session. Spoken meditation is now verified audible by the owner. Entry is
  Breathe -> Start one minute; opening the panel alone does not start speech.

## SOFTER MEDITATION, MUSIC, REMINDERS, DARK NAV (Oct 16, 2026)
- Owner requested a more soothing voice and meditative music, then meditation
  reminders and clearer purple icons in dark navigation. These requests are
  implemented together; trailer music remains a separate pending decision.
- Added Soft voice (af_sky, speed 0.78, mild high/low-pass and quieter level),
  keeping Original voice (af_heart v1) selectable side by side. New versioned
  guided/own-pace v2 files; build-breathing-audio.mjs --soft uses only local
  models and explicitly blocks remote fetching. No credits spent.
- Added original synthesized ambient music, soft chord pads and sparse bell
  tones with fade-in/out: scripts/build-meditation-music.cjs -> public/audio/
  meditation-music-v1.m4a. No third-party recordings or music services. Music
  defaults on at 25%, independent checkbox/volume; voice mute is separate.
  Both tracks pause/stop together and stay synchronized. Retained v1 files.
- Breathe -> Set a reminder opens MeditationReminderForm (local date/time,
  optional daily repeat, rejects past dates). Saves a standard timed task
  "Meditation break" through the existing local task/reminder engine. Edit or
  remove in Tasks. Explicitly explains awake/running requirement; never
  starts a meditation automatically. No new cloud/calendar integration.
- Meditation Start/Pause/Stop buttons now stay in a fixed footer while the
  content scrolls if needed, keeping playback controls reachable.
- Dark RadialMenu and QuickNav inactive icons use pale lavender #cbc1ff;
  active QuickNav explicitly uses purple background/white icon in dark mode.
  Light-theme palette unchanged; Showcase remains deliberately discreet.
- Timeline/script checks for both voice versions passed; build passed and
  all 31 proxy tests passed. Full interaction/contrast QA recorded below.
- Full muted desktop QA passed: past reminder dates rejected, daily reminder
  created in sample Tasks, soft voice/music playback and sync, separate mute,
  pause/resume, switching back to original voice, full minute and Stop.
  Dark inactive icon contrast measured 9.14:1 in BOTH nav bars. Screenshots
  and report in docs/qa/2026-10-16. No real reminders added to owner's data.
  Restarted the app once for owner testing; new softer/music preference still
  awaits her listening feedback. No push/deploy/public release.
- Native verification after restart: pale lavender dark-menu icons visible;
  Breathe shows Set a reminder, Soft voice selected, Music checked at 25%,
  and Start one minute. Left that panel ready for her; no session auto-started.
- Owner reported meditation still not starting/sounding. Confirmed only the
  latest app process running. Found BrowserWindow omitted acceptFirstMouse;
  installed Electron types document macOS defaults false (first click on an
  inactive window only focuses it). Enabled acceptFirstMouse so desktop
  controls accept that first click. This is a plausible contributor, not a
  proven sole cause of her report. Ready label now explicitly says "Press
  Start to hear your guide." Build/syntax/whitespace checks passed; verify
  actual desktop playback and owner experience after this single restart.
- After restart, native Start click switched to Pause and began the actual
  Soft voice + Music session. Gayathri confirmed "Both the voice and music"
  are audible. Keep app running; no further restart. First-click option is
  corrected, but do not claim its default was conclusively the only cause.

### Oct 16, 2026 — recurring meditation Start failure, click-through correction
- Owner reported failure again after hearing both tracks previously; clarified
  that the panel still says Start one minute. Previous audio-only/AX checks
  were insufficient evidence that her pointer interaction works reliably.
- Found a concrete state mismatch: App.tsx cached native click-through locally,
  while PanelResizeHandles independently sets it true on release. A subsequent
  same-state poll could skip restoring clicks over Start (or other controls).
  Removed the renderer-local cache; deduplication now lives in the main IPC
  handler that sees all requests, including resize changes and window replacement.
- Added scripts/test-click-through.cjs exercising actual renderer request body
  and main handler: resize-release recovery, duplicate polls, replacement window.
  Passed, alongside breathing timeline/script tests, build, and main syntax check.
- Added an explanation if an active reminder/activity disables meditation Start.
- Restarted development app once. Audio files unchanged; no paid calls or
  publishing. This fixes a demonstrated code flaw, but owner confirmation of
  reliable Start via her own mouse is still pending; do not claim sole cause.

### Oct 16, 2026 — correction to the preceding restart claim
- Owner again reported failure. Process inspection showed the previous restart
  was NOT successful: sandboxed launch session 92786 exited SIGABRT during
  macOS application registration, before app startup. The still-running app
  was PID 46718 from 17:20:55, not the corrected build. Native quit actions
  had returned a UI-change error and had not stopped it. Do not interpret
  an initial running command result or rebinding CUA as restart confirmation.
- Stopped that exact older dev process with SIGTERM, then launched npx electron .
  outside the command sandbox. Verified exactly one main app process, PID 49144,
  started at 17:30:58 local time, and launch session 39969 remains running without
  errors. Native state confirms the Companion window. No new code changes here.
- This corrects the rollout of the click-through fix; owner mouse-click result
  still pending. Do not claim the recurring meditation issue fully resolved yet.

### Oct 16, 2026 — meditation Start root cause captured and fixed
- Captured the owner's actual failed pointer input using opt-in local development
  diagnostics (COMPANION_DEBUG_INPUT=1, scripts/debug-meditation-input.cjs).
  Start was enabled, audio readyState=4, paused at 0. Its rect was x232.7/y591,
  width118.9/height28. Owner clicked x281/y612, inside Start, but event target
  was a DIV outside the meditation panel and the panel closed.
- Root cause: the artwork was scaled to 0.7 (168px tall), but its sibling
  data-char-hit layer stayed 240px tall. That invisible layer overlapped the
  panel footer and, painted later, intercepted Start as a plant click. This
  explains why AX/programmatic button activation worked while owner clicks
  did not. Earlier click-through fixes did not address this overlap.
- Moved the hit layer INSIDE the same scaled wrapper as Blob, and gave the
  panel/nav stack z-index 10 so controls stay above the plant drag surface.
  Visible artwork size, voice/music tracks and owner's settings unchanged.
- Added scripts/site/qa/check-meditation-hit-area.cjs: isolated full production
  app, fake local data, muted audio, external requests blocked. At scales
  0.6, 0.7, 1, 1.2 checks Start center/edges hit the real button, then sends
  pointer down/up and verifies Pause plus progressing voice and music.
  All passed. Negative control at 0.7 restores the old hierarchy and stacking
  and reproduces the intercepted click. Initial runner needed a window lifecycle
  correction; successful complete rerun exits 0 with all four sizes passing.
- Build, click-through regression, breathing/script checks, diff whitespace pass.
  Stopped diagnostic PID50101 and launched npx electron . normally, diagnostic
  output off. Confirm fresh process and owner experience before calling their
  interaction verified. No publishing, paid calls, or personal-data changes.
- Owner confirmation after the corrected build: "Yes, it's working now, I can
  hear both the voice and music." Her own Start click now succeeds; the plant
  hit-area overlap fix is verified by the owner, beyond the automated tests.
  Leave this working app running; no further restart or audio changes.

### Oct 16, 2026 — Git checkpoint requested by owner
- Reviewed the accumulated work on ui-refresh-shadcn for a local checkpoint:
  preserved A/B plus new A2/B2 pages, chat tone/starters, local guided meditation
  and music, meditation reminders, dark-navigation readability, and the
  owner-confirmed plant hit-area fix, with source assets and regression checks.
- Added the missing *.key ignore rule to enforce AGENTS.md's existing secret
  policy. Per-machine Google/beta config and models remain ignored. No personal
  root files included; QA images come from sample galleries/local landing pages.
- Existing build and targeted regression results remain valid; no runtime
  changes or restart needed for this checkpoint. Prepare local commit first;
  GitHub push awaits explicit confirmation under the owner's standing rule.
- Owner explicitly approved upload to ui-refresh-shadcn, not main. Pushed
  a823b30 (guided meditation and refreshed landing page options) successfully
  to origin/ui-refresh-shadcn. Main was not targeted. This follow-up memory
  note is saved on the same branch as part of the approved GitHub update.

### Oct 16, 2026 evening — cleaner meditation, movement and everyday voice
- Owner requested a cleaner meditation panel inspired by her supplied screen
  recording: inspected a local contact sheet (do not commit the personal video).
  Added decorative flowing lavender/coral waves, large mm:ss timer, 1/3/5-minute
  choices, My own pace, voice/music toggles and volume. Waves pause with playback
  and in My own pace per her clarification; no separate still-mode setting.
  Retain OS reduced-motion support. Waves are decorative, not audio analysis.
- Preserved original UI as BreathingPanelV1.tsx alongside the new panel in the
  dev gallery. Original audio/voice options preserved. Reminder control moved
  from meditation into Settings > How I care for you > Meditation reminder,
  using the existing local task scheduler and optional daily repeat.
- Longer guided and own-pace recordings reuse original local v2 voice segments:
  scripts/extend-meditation-audio.cjs; generated 3/5-minute music locally with
  build-meditation-music.cjs. No network/AI credits. Complete four-second phases,
  single introduction and ending, master clock remains recorded audio.
- Movement breaks replace the Stretch breaks settings label. Default Mix it up
  alternates stretch and walk/move nudges on the existing cadence/cap. User can
  choose Stretch or Walk or move. Inclusive copy; existing stretch animation
  reused, no newly generated walking art. Walk added to beta debug nudge menu.
- Owner clarified bubbly voice means the character overall, not meditation.
  Existing saved voice was af_sky (Light). Prepared local before/after samples
  in public/audio/voice-options using build-voice-comparison.mjs. Everyday
  Bubbly friend uses af_bella at synthesis speed1.0; Warm original/Light remain.
  No pitch-shifting and no paid/cloud calls. Owner has not yet selected/approved
  that voice; meditation keeps af_sky v2. Current personal voice setting preserved.
- Verification: TS/build pass; all31 proxy tests pass; full production pointer
  regression at scales .6/.7/1/1.2 passes. New gallery checks cover all three
  durations, playback/pause/resume/seek-to-ending, self-paced wave state,
  Settings reminder creation and movement choices. QA images meditation-clean-
  light.png and meditation-clean-dark.png. Tests initially needed selector and
  state-flush fixes; final runs pass. Native app restarted once outside sandbox,
  PID58955; observed owner starting the new panel and countdown reaching0:51.
  Stopped UI automation when owner began interacting. No GitHub push this session.

### Gmail, beta access and Spotify research (official sources, Oct16)
- Gmail standard API use currently has no additional cost; quota overages are
  planned to become chargeable later2026. Costly annual restricted-data security
  assessment is triggered by access through third-party servers. Current Gmail
  path uses metadata scope, local direct Google calls and local private speech;
  local-only design may avoid that server-assessment trigger, but public scope
  verification still needs Google review. Do not promise exemption or a fixed
  audit price. Gmail remains disabled; owner asked about costs, not re-enabling.
  https://developers.google.com/workspace/gmail/api/reference/quota
  https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- App itself/proxy has no email allowlist. Google Calendar access while OAuth
  project is in Testing requires listed test users (up to100), grants/refresh
  tokens expire after7days. We have not inspected current console publication
  state this session; phrase conditionally. Gmail remains off.
  https://support.google.com/cloud/answer/15549945?hl=en
- Owner asked whether Spotify sync costs more. Research only; no integration
  authorized/added. Current dev mode requires Premium owner and max5 allowlisted
  users; extended quota applications require organization and at least250kMAU.
  Spotify policy prohibits overlapping Spotify audio with other audio and
  restricts commercial streaming. Therefore our voiced guided music feature is
  not a suitable straightforward integration. Recommend bundled original music;
  optional future ordinary link to open Spotify separately, no sync/control.
  https://developer.spotify.com/documentation/web-api/concepts/quota-modes
  https://developer.spotify.com/policy

### Oct16 evening — minimal mesh-wave meditation panel and Gemini voice research
- Owner supplied a Sleep Lab reference and requested a much more minimal panel.
  Replaced oval waves with three layered fine-line lavender SVG ribbons, gently
  moving only during guided playback; own pace, pause and OS reduced motion
  stop movement. Simplified timer, duration choices, sound controls and footer.
  Preserved previous panel as BreathingPanelV2.tsx and its oval waves as
  MeditationWavesV1.tsx, alongside original V1 and new design in the gallery.
- All local audio/playback behavior, Settings meditation reminders, 1/3/5 minute
  sessions and plant hit-area fix retained. No cloud calls added.
- TS and app/gallery builds passed; playback/pause/resume/end tests passed for
  all durations; self-paced animation, reminder creation and movement choices
  passed. Pointer regression passed at .6/.7/1/1.2. The gallery test previously
  assumed local audio loaded within1.2sec and intermittently failed with unknown
  duration; it now waits up to10sec for actual playback before asserting.
  New screenshots: docs/qa/2026-10-16/meditation-mesh-{light,dark}.png, both
  visually inspected. Old screenshots retained. Restarted exact prior PID58955
  with the rebuilt development app, without launching the packaged installer.
- Owner asked about Gemini3.8FlashTTS for overall plant voice. Researched official
  Google speech docs, pricing and terms, without using credits or sending text
  to speech generation. Can integrate, but not yet authorized cloud voice changes.
  Free tier exists for auditions; production dynamic speech needs Google API
  credentials and usage billing. Listed standard audio rate is$0.00225/10sec
  through Dec31,2026 ($1.35/100min), doubles Jan1,2027, plus text input charges.
  https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash-tts
  Paid terms exclude model improvement but permit limited safety retention;
  unpaid terms differ and have regional/account exceptions. Recommend generic
  prerecorded greetings/nudges/meditation first, reusable locally without per-play
  costs. This cannot give arbitrary live chat replies the same voice without
  sending reply text to Google. Existing local voice remains, no keys requested
  or personal/calendar/task text sent. No GitHub push this session.
  https://ai.google.dev/gemini-api/terms
  https://ai.google.dev/gemini-api/docs/speech-generation

### Oct16 — colourful waves with controls at the bottom
- Owner requested colourful waves and more space for them, with controls lower.
  Waves now blend turquoise, lavender, pink, blue and peach across three ribbons.
  Their flexible full-width area fills the upper body; countdown and duration
  choices share a row below, with own pace/voice/music and action buttons at the
  bottom. No audio or privacy behavior changed. Own pace still stops animation.
- Preserved previous lavender design as BreathingPanelV3.tsx with
  MeditationWavesV2.tsx, added to gallery alongside other versions.
- TypeScript/app/gallery builds passed. Verified all three durations, actual
  voice/music playback, pause/resume/end and self-paced behavior; pointer tests
  passed at plant scales .6/.7/1/1.2. Gallery test now waits for audio clock>.25s
  before pausing (an earlier pause before the first UI tick had no Resume label).
  Inspected new meditation-colour-light.png and meditation-colour-dark.png under
  docs/qa/2026-10-16; no clipped controls. Previous screenshots retained.
- Restarted identified old development app PID61668 after validation. No paid
  generation, external services, personal settings changes, commits or pushes.

### Oct16 — faster meditation waves
- Owner found the colourful wave motion too slow. Shortened the three ribbon
  loops from12/15/18seconds to4/5/6seconds, exactly3x faster, retaining smooth
  easing, colours and layout. Own pace/pause/reduced-motion behavior retained.
- Preserved original slow speed via waveSpeed="slow" and a separate gallery
  example, without adding another setting to the user's minimal panel.
- TypeScript and production build passed. This changes only animation timing;
  audio/session logic untouched. Restarted identified development PID62853
  with the new build. No paid calls, publishing or GitHub push.

### Oct16 — plant over other apps' full-screen Spaces
- Owner reported that full-screen apps make the plant disappear, and wants it
  to remain until dismissed. Changed macOS BrowserWindow type to panel, the
  Electron-documented native type that can float over other apps' full-screen
  Spaces. Kept floating/all-workspaces flags, Dock home, click-through and
  existing explicit Nap/hide behavior; no force-show timer or focus stealing.
  Existing user-selected call auto-hide setting remains respected.
- Official reference: https://www.electronjs.org/docs/latest/api/base-window
  (macOS panel window type). Syntax check passed; restarted the identified
  development PID63582. No renderer build needed for this main-process change.
- Native CUA test: created an empty temporary Finder window at
  /tmp/companion-fullscreen-check, entered macOS full screen, opened plant's
  menu/Tasks and successfully typed then cleared an unsaved "Window check"
  draft. Closed Tasks; no task was added. Asked owner to confirm visual presence
  over Finder; confirmation is still pending, so do not claim owner verification.
  Finder full-screen test window remains open for that confirmation.
- No network calls added, paid work, public changes or GitHub upload.
- Owner confirmed the full-screen fix: "Yes, the plant is visible" over the
  full-screen Finder test. This is now owner-verified. Tried to close the
  temporary Finder window afterward, but CUA returned cgWindowNotFound on
  both the existing binding and a fresh Finder lookup; no other window closed.

### Oct17 — private beta release checklist
- Owner requested a checklist of everything the app must pass before beta.
  Created docs/release/beta-launch-checklist.md in plain language, with release
  gates, prior evidence, pending decisions and checks for the exact installer.
- Covers privacy/context sharing and deletion, real OpenAI/tone/distress checks,
  cost limits and migration, tasks/reminders, wellness/meditation/growth, desktop
  behavior, accessibility, clean installation/reliability, optional Calendar,
  tester materials/feedback and final owner approval. Separates deferred public
  launch, onboarding, art, cloud voice/Spotify and testing-tool removal.
- Confirmed current source still sends task/fact/history context with chat;
  proxy counters fail open; original pages/trailer email cleanup and real OpenAI
  eval remain pending. Found tester-guide source still promises Gmail and Google
  cloud speech, so updating it is an explicit release blocker. Landing macOS12
  support is unverified; checklist requires checking actual bundled runtime support.
- Owner-confirmed meditation audio and full-screen visibility are recorded as
  prior development-app evidence, not installer sign-off. No tests rerun or
  account/provider settings inspected; no spending, publishing or code changes.


### Oct17 — privacy pass; chat remains a core feature
- Owner requested fixing beta checklist items one at a time, privacy first and
  outdated tester guide next, with a check-in after each. During this pass she
  clarified: no chat-off option; the plant is an AI friend users can talk to.
  This supersedes the older chat-off requirement. Updated AGENTS.md and added
  a dated current-policy note to PRD.md; old historical decisions remain.
- Removed the chat on/off switch. Chat now has a one-time “Before we chat”
  explanation and “Start chatting” button. Acceptance alone sends nothing;
  only an explicitly sent message starts an AI request. Existing users see
  the notice once; legacy chatOn settings are retired. Missing/corrupt/unaccepted
  settings fail closed, and the unused background AI endpoint is disabled.
- Prompts now contain recent conversation (up to16 messages including the new
  one), personality and local time, not private task lists, profile names,
  growth, saved notes or old summaries. Calendar capability can be indicated,
  but fetched calendar contents stay excluded. Removed automatic approximate
  search location. User-entered chat details and research search terms still
  leave the Mac; explained this explicitly. Saved notes no longer give the AI
  automatic long-term recall; remembering is requested explicitly in the prompt.
- Forced all speaking voice local, including legacy key/config fallback paths.
  This does not remove prerecorded meditation audio or voice-choice options.
- Chat cancellation added for history deletion, personal-key changes and full
  reset. Both SDKs receive abort signals; renderer checks request IDs so late
  responses cannot restore deleted chat or create tasks. Failed saves block
  sending. History deletion clears summary as well, retains saved notes.
  Individual note deletion, key deletion and Google disconnect report failures.
- Delete all removes known local personal files (chat/tasks/settings, personal
  AI/TTS keys, Google tokens/client, window state, device ID), stops polling,
  cancels chat and disables start-at-login. Blocks stale renderer saves during
  reload, reports partial failure honestly. OAuth/poll generation guards prevent
  late connections/events after disconnect/reset. No owner data was deleted.
  Local data writes now enforce owner-only file permissions, including old files.
- Added site/privacy.html, linked from all four page options. Corrected their
  chat/privacy wording for the core-feature decision, local voice and deletion.
  Clear distinction: store:false disables saved Responses retrieval, not all
  provider retention; no approved Zero Data Retention claim. Official reference:
  https://developers.openai.com/api/docs/guides/your-data
  Original email scenes/trailer cleanup remain pending, not silently completed.
- Updated proxy README privacy caveats and beta checklist progress. Anchored
  /release/ in .gitignore so docs/release is no longer accidentally ignored;
  secrets/model/personal-file exclusions remain unchanged.
- Validation: TypeScript and production build pass (existing bundle-size warning).
  All31 proxy tests pass. scripts/test-privacy.mjs passes using VM storage/SDK
  doubles, including both providers, missing/corrupt consent, prompt minimization,
  cancellation, local-only voice and synthetic reset/failure cases.
  All17 offline Google checks pass; corrected an old test that expected Gmail
  polling despite the deliberately disabled Gmail feature. Two bundled-client
  subcases are skipped by that existing test to avoid touching owner config.
- New scripts/site/qa/check-privacy.cjs tests the actual renderer offline with
  synthetic data: first-chat notice, no off switch, no draft upload, minimal
  prompts, cancellation/late-action suppression, deletion across reload, saved
  note deletion and honest failure UI. Passes. Captured and visually inspected
  chat introduction, privacy Settings, and privacy page desktop/phone screenshots
  in docs/qa/2026-10-17. Fixed truncated Settings descriptions found in that review.
- Launched rebuilt development app (PID3586, exec session87600). CUA confirmed
  Companion window loads project dist/index.html and plant is visible. Closed
  unrelated empty Electron welcome window through its Quit menu; no packaged
  Companion launched. No user chat sent, paid call, push, deployment or publishing.
- CHECK-IN: privacy implementation/wording pass ready for owner review. Tester
  guide deliberately untouched until the next step. Final installer, live server
  configuration/observability, provider retention/account settings, stronger beta
  access controls and reliable cost caps still require release checks; these
  offline tests are not a complete security audit or production privacy sign-off.


### Oct17 — remove Claude integration and app-owned keys
- Owner explicitly requested complete removal of Claude integration, then deletion
  of any Claude keys. Current app is OpenAI-only: removed the Anthropic SDK and
  its unused dependencies, provider selection, Claude request implementation,
  model settings and ANTHROPIC_API_KEY environment fallback. Old sk-ant keys
  are rejected/ignored rather than accidentally sent to OpenAI. Old beta provider
  fields cannot select another provider. Private beta-config set to openai
  without displaying credentials. Historical CLAUDE.md name/history retained.
- Worker source now has only the OpenAI chat route; /v1/messages returns404.
  This code is NOT deployed yet. Reworked existing proxy tests to cover OpenAI
  authentication, streaming, citations, headers, errors and limits; added explicit
  retired-route rejection even when an obsolete secret is present. All31 pass
  without skipped SDK tests or any paid requests. Cost-counter weaknesses noted
  in the previous privacy pass remain a separate issue.
- Updated app labels/comments, privacy page, server README/config and AGENTS.md.
  Corrected provider references in both tester-guide files; their broader Gmail,
  voice and onboarding cleanup remains pending the requested separate guide pass.
  PRD keeps historical plans with an explicit current OpenAI-only override.
  Personal OpenAI-key controls remain visible in the development app even when
  it is configured for the beta server, so the owner can enter her own key.
- Personality evaluator now OpenAI-only and matches app search request (no
  automatic approximate location). Adjusted memory/completion fixtures to ask
  explicitly and follow-up fixture to use recent chat, matching the privacy
  changes. Only DRY=1 run:20 cases loaded, no live personality evaluation.
- Deleted the actual sk-ant key from this app's userData/brain.key with owner's
  authorization. Verified file absent, no legacy environment key present, and
  no project .key/.env files found outside excluded dependencies/builds/models.
  No unrelated project credentials touched and no secret values printed.
- Cloudflare secret list showed only ANTHROPIC_API_KEY and APP_TOKEN (no OpenAI
  secret). Automatic approval review initially blocked confirmation of permanent
  deletion and required fresh action-time consent. Owner then explicitly confirmed
  deleting ANTHROPIC_API_KEY from companion-proxy. Wrangler reported success;
  a fresh secret list contains only APP_TOKEN. This authorized live secret change
  is complete. It does NOT revoke the old credential in the company's Anthropic
  account. No provider-account revocation attempted.
- Consequence explained to owner: chat cannot answer until her OpenAI key is
  added and tested; local tasks/reminders/meditation still work. Already distributed
  old installers are not rebuilt or modified; do not distribute them as the new
  OpenAI-only release. Removing the legacy endpoint from the live Worker requires
  separate approval to deploy the tested source change.
- Validation: TypeScript and app build pass (existing size warning). npm confirms
  @anthropic-ai/sdk absent. Privacy VM tests pass, including legacy saved/env keys
  and beta provider config never routing to the old service or leaking its key.
  Actual renderer privacy checks pass offline, screenshot outputs refreshed.
  Restarted old development app via its Quit menu, launched updated Electron
  (exec session77394) and reloaded final Settings change. CUA confirms project
  dist/index.html in Companion. No paid calls, GitHub push or Worker code deploy.


### Oct17 — authorized OpenAI-only server deployment
- Owner explicitly said to leave the company account alone and approved deploying
  the server change that removes the old Claude connection. Company Anthropic
  account and its credentials were not accessed or modified.
- Rechecked branch ui-refresh-shadcn and Worker configuration/source. All31
  offline proxy tests passed immediately before deployment, with no skips.
- Ran wrangler deploy for companion-proxy successfully. Live URL:
  https://companion-proxy.companion-proxy.workers.dev
  Version:442c970b-2da0-490a-ab95-4ad44b5b0f00.
- Verified live GET /health returns200 with ok:true; POST /v1/messages with an
  empty synthetic body returns404 not_found, confirming the old Claude route
  is removed. GET /v1/responses returns405 method_not_allowed, confirming the
  OpenAI route is present without making any paid AI request.
- Fresh Cloudflare secret listing contains only APP_TOKEN. The Claude secret
  remains absent; OPENAI_API_KEY has not yet been added, so chat cannot answer
  until owner supplies it and the real service is tested. No provider account
  revocation, AI credits, GitHub push, installer build or landing publication.
- Broader tester-guide cleanup remains the next separately checked-in item.

### Oct17 — chat privacy and free local-model options (research only)
- Owner asked whether users' chats can be protected and whether free open models
  could avoid API charges. Explained that current safeguards reduce exposure but
  are not a completed security audit: saved chat JSON has user-only file permissions,
  not app-level encryption; stronger beta access, credential/storage protection and
  final installer review remain pending. Cloud AI necessarily receives sent chat.
- Official OpenAI data controls distinguish no training by default and store:false
  from Zero Data Retention. Default abuse-monitoring retention can include chat for
  up to30 days (exceptions apply); ZDR needs approval and compatible features.
  Source: https://developers.openai.com/api/docs/guides/your-data
- Researched Apache2.0 downloadable candidates Qwen3-4B and SmolLM3-3B, plus
  Apple-silicon local execution through MLX LM. Free model files do not make hosted
  inference free. Running on each user's Mac can avoid per-message inference bills,
  with storage, memory, battery and support tradeoffs. Web search still sends queries
  outside the Mac and cannot be described as fully offline.
  Sources: https://huggingface.co/Qwen/Qwen3-4B
  https://huggingface.co/HuggingFaceTB/SmolLM3-3B
  https://github.com/ml-explore/mlx-lm
- Proposed a separate local-model trial to measure personality, reminder actions,
  response speed and resource use before choosing a production direction. This is
  a proposal, not an accepted provider change. Current OpenAI-only implementation
  remains unchanged. No model downloads, paid calls, deployment or GitHub push.

### Oct17 — proposed reminders-first beta without chat
- Owner proposed postponing chat until costs/privacy/model selection are settled,
  and asked about costs for a wellness/reminders beta. This is the latest product
  direction under discussion; do not insist on the earlier chat-as-core decision.
  No app feature changes made in this advisory session.
- Inspected existing code: tasks, offline natural-language reminder parsing,
  water/stretch/walk nudges and local voice already do not need cloud chat.
  Proposed retaining meditation, growth and authored personality lines, with a
  simple optional local daily check-in as future work, not an existing feature.
- Explained Electron runs the installed app on each tester's Mac; it is not a
  hosting service. GitHub stores code and can distribute installers via Releases.
  A reminders-only design needs no per-message AI charges or reminder server.
  It still needs reliable reminder behavior around sleep/restart, local data
  protection and accurate marketing/tester documentation.
- Checked official distribution costs: Apple Developer Program is USD99/year
  (regional price varies) for Developer ID signing/notarization; current installer
  is unsigned. GitHub Releases assets must be under2GiB; no documented total
  release bandwidth cap. Static landing page can use Cloudflare Pages free tier;
  large installer should be hosted separately. Domain/support/build services and
  any existing paid subscriptions are separate; no billing cancellation performed.
  Sources: https://developer.apple.com/programs/enroll/
  https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
  https://www.electronjs.org/docs/latest/
  https://developers.cloudflare.com/pages/platform/limits/
- Recommended a reversible reminders-first beta with chat preserved for later,
  no AI keys required for testers, no cloud voice, and no unneeded account/calendar
  integration in that proposed scope. No downloads, spending, deployment or push.

### Oct17 — step1: reminders-first development beta, chat disabled
- Owner explicitly approved no-chat beta while retaining Google Calendar alerts,
  tasks/reminders, wellness and meditation, and requested a check-in after each
  stage before privacy-page and tester-guide updates. Later clarified that voice
  recording for tasks/reminders must remain. This supersedes chat-as-core policy;
  updated AGENTS.md, PRD override and beta checklist accordingly.
- Added shared electron/features.json aiChat:false for renderer/main. Hid Chat
  from both menus, chat how-to, key controls and chat voice switch. Main blocks
  chat-send and key connection regardless of prior consent, saved key or config;
  does not load beta proxy config in this build. Background AI/cloud voice remain
  disabled. Packaging explicitly excludes beta-config.json. Deferred chat source
  and existing user data retained; legacy notes/history deletion remains available
  only where needed. Existing testing tools including Showcase preserved.
- Tasks retains its microphone, local Whisper transcription, editable draft and
  offline date/time parsing. Packaged Whisper now forbids remote model fallback;
  uses bundled model files. No AI service or paid call needed for dictation.
- Calendar remains optional, connected and polled as before. New authorization
  requests use calendar.events.readonly in this beta; older grants are not silently
  revoked. Settings no longer prompts read-only users to reconnect for booking or
  advertises chat booking. Local personal reminders do not create Google events.
- Updated necessary in-app welcome/how-to/privacy copy for the disabled-chat UI.
  Public privacy page and complete tester guide are next separately reviewed steps;
  do not claim they now match this release. No new installer built yet.
- Tests: TypeScript/build pass (existing bundle-size warning); all31 proxy checks
  pass offline; all17 Google tests pass (existing2 bundled-client subcases skipped
  to avoid touching owner configuration). Privacy VM suite keeps future-chat tests
  and adds shipped-beta rejection with old key/config/consent; passes.
- Renderer suite now routes by release flag, preserving previous chat UI suite in
  check-chat-privacy.cjs. New check-beta-without-chat.cjs uses isolated synthetic
  storage, blocked external requests and fake microphone audio/transcription output.
  Verifies microphone recording pipeline -> editable draft -> tomorrow6pm reminder,
  no automatic save, no chat/key controls or AI calls, Showcase retained, read-only
  Calendar connection accepted, meeting alert shown without persistent event data,
  and legacy data deletion. This does not establish real microphone recognition
  accuracy; owner should test a spoken reminder in the development app.
- Screenshots in docs/qa/2026-10-17/beta-without-chat-{tasks,voice-reminder,calendar,
  privacy}.png; inspected tasks and calendar captures. Synthetic test tasks only.
- Quit/restart via CUA was refused as stale target state. Identified exact old
  project Electron PID4811, terminated only that process, relaunched npx electron .
  (exec session73696). CUA verified correct project dist/index.html and visible
  plant. No duplicate packaged installer opened, user records untouched.
- Explained hosting: installed app runs on each Mac; propose installer downloads
  separately via GitHub Releases and landing page via Cloudflare Pages. Nothing
  uploaded, deployed, pushed, purchased or published this session.
- Owner asked how failures will be handled. Proposed restart/recovery plus a
  user-reviewed report containing only app/technical diagnostics, excluding task,
  audio and Calendar content; no automatic analytics/upload. Added pending release
  checklist item. Reporting/support flow not yet implemented; feedback contact
  remains owner decision. CHECK-IN: step1 ready for desktop review, then privacy
  page and tester guide, one at a time as requested.

### Oct17 — meditation/hula growth-stage animation request and break ideas
- Owner requested meditation animations at all7 growth stages, explicitly SOLID
  WHITE backgrounds; hula-hoop idle animation in addition to hammock; suggestions
  for other fun idle poses; and proposed meal plus coffee/tea breaks using existing
  reminders. Earlier privacy-page/tester-guide steps remain pending, not cancelled.
- Inventory: hammock already all7 stages; meditate and hula only stage4. Viewed
  original mascot-poses/meditate.png and hula.png (white-background references).
  Can preserve/reuse stage4 originals and add stages1/2/3/5/6/7 for each pose.
  Blob currently needs per-stage selection wiring for meditate/hula when assets
  are ready; idle rotation already filters to poses available at current stage.
- Read-only Higgsfield model/balance/cost checks:210.24 credits, pro; no active
  free-trial unlimited allowance. Existing pipeline quote remains1.5cr for a
  high1k GPT Image2.5 pose still plus7.5cr for5s standard silent Kling3.0 loop.
  Six missing meditation versions=54cr; six hula=54cr; both=108cr before retakes.
  Balance also reports1 Genjutsu free run and5 Influencer Builder runs; these are
  not the quoted Kling/image pipeline and were not used or silently substituted.
- Prepared docs/art/meditation-hula-plan-2026-10-17.json with stage references,
  pose/motion prompts, destination paths, exact settings/quotes and QA requirements:
  pure white source BG, correct foliage/flowers, short limbs, locked camera, safe
  margins, looping motion, local transparent cutouts, matching stage/scale in app.
  All existing versions retained. No images/videos submitted, uploaded or charged.
- Asked owner via async approval for9cr meditation sample (recommended),54cr full
  meditation set, or108cr both missing sets. Answer pending at time of entry.
  Explicitly cited AGENTS.md rule to ask before jobs above~5cr; no paid retries
  beyond approved budget. Do not treat the preparation or balance check as approval.
- Meal/beverage reminders proposal: optional named shortcuts with owner-selected
  date/time and daily repeat, using existing local Tasks scheduler and review/edit/
  delete/snooze, no default nagging or AI calls. Existing coffee art covers all
  stages; picnic/groove currently only stage4. No reminder UI change yet.
- Suggested additional idle ideas: reading/page turn, soap bubbles, headphone
  head-bob, picnic/snack. These are suggestions, not approved paid generations.

### Oct17 — owner confirms white source background + her Lumio removal
- Owner clarified solid white is intentional for clean removal and instructed us
  to use her Lumio (https://gayathriswaminathan-lumio.hf.space/), also on GitHub.
  This reply did NOT choose or approve a generation-credit budget. No paid jobs.
- Confirmed scripts/lumio_cutout.py and sprite-in.sh already use her local
  ~/Desktop/Background remover engine (same existing workflow used previously).
  Hosted URL could not be opened by web reader; local installation is available.
- Ran a real local smoke check on existing mascot-poses/meditate.png using Lumio
  with HF_HUB_OFFLINE=1 and TRANSFORMERS_OFFLINE=1. Produced1024x1024 transparent
  PNG /tmp/companion-lumio-meditation-check.png; corner alpha0, process exit0.
  Viewed resulting cutout. No file uploads, model downloads, credits, or changes
  to Lumio/source art. Runtime emitted existing LibreSSL/duplicate AV warnings,
  but check completed. Single-frame success is not full new-video edge/flicker QA.
- Updated art plan with explicit white generation -> own local Lumio removal ->
  transparent in-app animation workflow. Budget approval remains pending.

### Oct17 — stage1 meditation sample, corrected hands and lower-cost workflow
- Owner approved9 Higgsfield credits for one stage1 meditation sample on solid
  white, followed by her Lumio cutout. Spent1.5cr still +7.5cr silent5s Kling video;
  verified remaining balance201.24. Still job2b210e31-1175-4372-a683-12cfbf1e25ca;
  video jobc7635521-0eb3-4376-ab63-9313c3ad39be. Original files retained at
  mascot-poses/stage-poses/meditation-hula-v1/meditate-stage1.png and
  assets/clips/meditate1-v1.mp4. No app integration.
- Owner rejected fingers and pointed to existing meditation animation. First
  sample used stage1 foliage reference without the existing meditation image as
  an actual hand reference. Correct future workflow uses BOTH original meditation
  hands/body and exact growth-stage foliage. Preserve open palms, relaxed fingers,
  crossed legs, closed eyes and short arms from mascot-poses/meditate.png.
- Owner approved1.5 additional credits for a corrected STILL ONLY, then proposed
  built-in image generation instead. Used built-in imagegen with meditate.png
  plus bundleB/white-stage1.png. No additional Higgsfield credits spent. Corrected
  still displayed for owner review; saved as
  mascot-poses/stage-poses/meditation-hula-v1/meditate-stage1-v2-builtin.png;
  exact prompt saved beside it as meditate-stage1-v2-prompt.txt. Small green
  stage1 foliage, exposed soil, original open-palmed pose, solid white background.
- Completed original rejected video's local Lumio processing offline:61 PNG
  frames, final GPU run131s, output preserved under
  mascot-poses/stage-poses/meditation-hula-v1/rejected-v1-cutout/. Retained rawvideo
  and rejected still separately. Cutout processing is not approval of the hands;
  do not install rejected sample in app. Viewed middle cutout frame.
- Updated docs/art/meditation-hula-plan-2026-10-17.json with status, costs and
  corrected-reference workflow. No second video submitted or approved. Owner
  should review corrected still before separately approving animation credits.
- Explained tool capabilities: built-in still-image generation and code animation;
  local video editing/loops/frame assembly; no built-in video-generation tool in
  this chat. New generated character motion uses connected Higgsfield. Preferred
  workflow: built-in still -> owner review -> approved Higgsfield animation ->
  own Lumio background removal. No app changes, publishing or Git push this pass.

### Oct17 — corrected meditation still approved
- Owner attached and approved the corrected built-in stage1 meditation still: "the still is okay". Recorded approval in the art plan. Preserve this exact open-palmed pose, small leaf cluster and solid white source background.
- Still approval is not an additional video-credit approval. Next proposed step is one silent5s Kling standard breathing loop, then own Lumio cutout; separate7.5-credit animation approval pending. No new generation, spending or app integration this turn.

### Oct17 — corrected video completed; owner flags restricted motion; reusable skill
- Owner explicitly approved7.5 credits for one corrected stage1 animation, same
  hands/growth stage, solid white, then Lumio. Uploaded approved built-in still
  directly from Mac; confirmed media cd916868-89d4-4e51-8e78-6e00e55e53fd.
  Fresh exact preflight7.5cr. Submitted once: job
  cb1e4942-7518-421e-bc9e-8e4ba4125862, Kling3.0 std5s silent1:1, approved still
  as start/end. Completed; raw saved assets/clips/meditate1-v2.mp4. Full submitted
  request saved docs/art/meditate-stage1-v2-video-request.json.
- Ran owner's local Lumio offline with graphics access:61 frames,163.2s, successful.
  Frames in mascot-poses/stage-poses/meditation-hula-v1/meditate-stage1-v2-cutout;
  transparent VP9 encoded assets/clips/meditate1-v2-cutout.webm. Alpha0..255 checked,
  sampled cutout composited on dark/light backgrounds; source/hands and edge sheets
  saved docs/qa/2026-10-17/meditate-stage1-v2. Sampled anatomy/foliage retained.
- OWNER CORRECTION: existing meditation also has gently moving hands and leaves,
  and floating movement. Owner said to prompt carefully in one go and protect
  credits, suggested adding a skill. Acknowledged the v2 prompt explicitly froze
  hands and excluded floating; this was our mistake, not an unexplained model
  failure. Still approval must not be interpreted as freezing movement.
- Inspected timed frame sheet of original assets/clips/meditate.mp4: vertical
  floating cycle and changing arm/leaf positions. Saved original-motion.png in
  QA folder. Correct brief must preserve hand anatomy while allowing forearm/hand
  drift, gentle leaf sway and whole-character floating, closed eyes/crossed legs.
- Created and validated docs/art/skills/companion-character-animation/SKILL.md
  using skill-creator instructions; installed discoverable symlink at
  ~/.codex/skills/companion-character-animation. AGENTS now points to it. Skill
  covers actual motion/appearance references, complete prompt contradiction check,
  exact cost/approval, one submission, no silent paid retries, own Lumio, QA of
  both motion and appearance, preservation of versions. No promise that generative
  models always succeed on first attempt. quick_validate passed.
- Marked v2 as motion correction pending, not accepted final animation. No app
  integration, replacement of stage4 art, additional paid submissions, Git push or
  publication. Higgsfield spend this turn7.5cr; cumulative sample spend16.5cr
  (initial9 plus corrected7.5). Built-in corrected still used0 Higgsfield credits.
  Any further paid generation requires a newly approved budget. Earlier approval
  of1.5cr corrected paid still was superseded by built-in workflow, never spent.

### Oct17 — free local stage1 meditation motion correction
- Owner asked to fix motion without more credits, matching original gentle float,
  hand and leaf movement. Used companion-character-animation skill. No Higgsfield
  calls, uploads, generation credits or new model downloads this turn.
- Used original assets/clips/meditate.mp4 as actual motion measurement source:
  feature tracking with forward/back checks and robust transforms on body, each
  hand, foliage. Original body rises/falls about46.8px at960px canvas. Fitted two
  periodic harmonics to remove jitter and close loop. Kept stage1 appearance from
  approved built-in still, cut out with owner's local Lumio offline.
- Added scripts/pipeline/meditation-local-motion.py. Local 2D correction moves
  whole character vertically, each hand rigidly relative to body with blending
  confined to arm attachment, and separately sways small stage1 foliage. Hand
  design is preserved; leaves remain stage1. Translations scaled to target size.
  Premultiplied-alpha resampling avoids coloured edge halos. No source overwrite.
- Base: mascot-poses/stage-poses/meditation-hula-v1/meditate-stage1-v3-local-base.png.
  Output: same directory/meditate-stage1-v3-local/,120 RGBA frames,720px,24fps,5s.
  motion-report.json records original tracks and applied movement. Transparent
  VP9: assets/clips/meditate1-v3-local-cutout.webm. Dark-background viewing copy:
  docs/qa/2026-10-17/meditate-stage1-v3-local/preview.mp4; requested Codex preview
  panel (tool returned queued). Also supplied inline video in final response.
- Checked sampled motion on dark/light backgrounds, close-up fingers/arm joins,
  canvas margins and loop transition. Float range34.67px at720px. Minimum margin
  61px. Premultiplied pixel seam change0.00137 vs median adjacent0.00186 (no seam
  spike). Rendered/encoded successfully. Sheets and checks.json beside preview.
- Explained this is local 2D motion correction, not a new 3D generated performance.
  Ready for owner visual review; not installed into app yet. All earlier versions
  retained. Spend0 credits. No Git push, deployment, or unrelated app changes.
- Added reuse guidance to the animation skill for this specific still/reference;
  do not reuse its attachment coordinates blindly for other growth stages.

### Oct18 — meditation stages integrated; task input repair in progress; Ollama discussion
- Owner approved stage1 local motion and authorized remaining meditation stages without per-stage approval. Built-in image generation produced stages2,3,5,6,7 using approved stage1 hands/body and each existing stage foliage reference. Used local Lumio cutouts and measured original meditation motion, no additional Higgsfield credits. Original stage4 retained.
- New stills/cutouts/layouts/120-frame loops: mascot-poses/stage-poses/meditation-hula-v1/meditate-stageN-v1-* for2,3,5,6,7; approved stage1 remains v3-local. Generalized scripts/pipeline/meditation-local-motion.py for stage layouts. Added import-local-meditation.py, preserving existing assets. Public meditate1,2,3,5,6,7 and sprite manifest integrated; Blob selects exact growth-stage meditation and applies potScale. process-clip preserves fps/pingpong metadata.
- Visually reviewed art and motion contact sheet at docs/qa/2026-10-17/meditation-all-stages/motion-contact.png. On Oct18 fresh vite build passed (existing large-bundle warning). Isolated Electron check-meditation-stages.cjs passed all7 stages: correct pose, decoded frame, advancing animation; screenshots docs/qa/2026-10-17/meditation-in-app/stage-N.png. Desktop app still needs latest relaunch/owner check.
- Owner reports Tasks accepts neither typing nor microphone. Added trusted panel-click native focus bridge (focus-controls), pending microphone-start cancellation/release handling, keyboard hold support and visible microphone errors in TaskPanel. Earlier typecheck/syntax checks passed; physical input and final regression checks still pending. Mac was locked during previous physical test, owner unlock requested. Do NOT claim this issue resolved yet.
- Owner asked whether Ollama could supply free chat. Researched official Ollama FAQ, API intro, macOS and pricing docs. Local models run on each user Mac without per-message cloud charges and can keep prompts local; cloud models are separate, usage-limited/paid. Recommend optional local-only prototype with cloud disabled, model/license/hardware validation and no silent cloud fallback. No Ollama install, model download or chat re-enable performed; current no-chat beta flag remains in force pending explicit decision.
- No git push, deployment, paid generation or publication this session.

- Oct18 owner requirement for any future local chat: users must only download our app and start using it, with no separate Ollama installation or technical setup. Explained normal Ollama connection needs installed runtime, but an embedded local engine/model can provide a single-app experience. Candidate llama.cpp supports Apple silicon; model redistribution licence, package size, memory, speed and battery must be tested before committing. No implementation or chat re-enable this turn.

- Oct18 owner asked to explore a phone version before doing more: wants to try a floating companion. Researched official Android overlay permission/window docs and Apple WidgetKit/ActivityKit. Android can support a draggable overlay with explicit user permission and system restrictions; iPhone cannot offer an arbitrary persistent mascot above other apps via supported public APIs, so widgets/in-app plant and time-limited Live Activities are alternatives. Awaiting phone platform before any prototype; no mobile implementation, downloads or publication.

- Oct18 iPhone follow-up: researched Apple Picture in Picture and Live Activities. Closest floating experiment is genuine guided meditation video in system PiP, with rectangular system-controlled player/controls, not transparent freely interactive always-present mascot. App Store acceptance cannot be promised for repurposing PiP as a persistent pet; background services must serve intended purposes. Dynamic Island/Lock Screen Live Activity suits active meditation/focus sessions, not all-day continuous character animation. No prototype created yet.

- Oct18 conversation lookup: owner asked where the previous project chat went. Codex's archive list contains "Read project context files" (01a143dc-b01c-7611-9cd0-6a24e79b8412), with this repository as its working folder. Read its latest turns and confirmed the last discussion was the iPhone floating-companion possibility. Chat is archived and readable; the available record does not explain why it was archived. No restoration or sidebar changes requested or performed.
- Oct18 conversation restored: owner explicitly requested restoration. Successfully unarchived "Read project context files" (01a143dc-b01c-7611-9cd0-6a24e79b8412) and requested opening it in Codex. No app code changes.

- Oct18 correction after owner pointed to existing phone pets: verified Pixel Pals App Store listing (id6443919232) and SpritePals developer site (spritepals.app). Both offer pet presence using widgets/Live Activities/Dynamic Island; SpritePals explicitly advertises animated companions. Earlier recommendation privileging meditation PiP and implying phone pets cannot animate was too broad. A plant in Dynamic Island plus widgets is a real prototype direction, subject to actual device/iOS animation/lifecycle testing. Freely roaming transparent overlay across arbitrary iPhone apps remains distinct and unsupported by a general public overlay API. Ask owner for the specific pet app if she means a different presentation.

### Oct19 — launch requested
- Built latest local app successfully (existing bundle-size warning only); confirmed no existing Companion/Electron app process before starting npx electron .
- Verified native Companion window displays the local dist/index.html with stage1 growth controls and idle state. Latest meditation assets and pending input fixes are in this build; this launch alone does not verify the microphone/typing issue. No code changes, publishing or Git push.

### Oct19 — remove duplicate plant at 6-to-7 growth ending
- Owner saw a duplicate end frame after full bloom. Inspected source frame sheet: individual frames are intact. Reproduced in isolated renderer: grow-to-idle handoff draws last growth sprite over stage7 idle for480ms; differing foliage and scale show double flowers/arms. Baseline sampled30 double-image moments.
- Blob now switches directly from grow6to7 to preloaded stage7 idle, without the transparent overlay. Other growth handoffs retained. Added missing grow6to7 size calibration0.9174 in src/generated/growHandoff.ts (end pot184px, idle190px, accounting for stage7 1.09 scale). Original clips and frames unchanged, no generation/spend.
- Added scripts/site/qa/check-growth-handoff.cjs with synthetic storage, blocked external requests, captures and duplicate-layer assertion. Before/after screenshots and frame traces in docs/qa/2026-10-19/grow6to7; after has0 duplicate-image samples and ends at stage7 idle. Inspected before/after screenshot; typecheck and vite build passed (existing size warning). Relaunched desktop app for owner replay from6→7 test button. No push or publication.

### Oct19 — reminder and joke testing touchpoint
- Owner requested a test touchpoint for all reminders and jokes. Added development-only Settings → Test reminders & jokes, near top of Settings. New src/ui/ReminderTestPanel.tsx lists13 previews: stretch, walk, water, bedtime, timed/missed/daily tasks, meditation, meal, tea/coffee, Calendar5min/startingnow, joke. Meal/coffee/meditation reuse timed task reminder behavior; no new automatic break scheduler claimed.
- Previews use actual ReminderBubble/NudgeBubble, current-stage poses, existing chirps and on-device speech with current voice/sound settings. Clearly labelled test previews; Done/Snooze/Did it/dismiss return to selector, joke What? reveals punchline. No task/schedule changes, growth points, nudge caps, bedtime dates or joke-history writes. Calendar uses synthetic meeting, no Google calls. Existing debug nudge/joke buttons now route through safe previews too. Real alerts preempt tests and are not discarded.
- Growth test strip temporarily collapses while testing so it cannot obscure controls; saved visibility preference retained. AGENTS records new dev-only testing aid for removal at public launch. Other testing tools preserved.
- Typecheck and build passed (existing bundle warning). Isolated Electron check-reminder-tests.cjs passed all13 poses/interactions, unchanged saved-data assertion after each, actual Calendar event priority and return to tests. Packaged-app mode verified no Settings test button. Light/dark panel and reminder/joke screenshots under docs/qa/2026-10-19/reminder-tests. Synthetic test muted audio; owner can hear previews using her normal voice settings in relaunched app. No network service, paid credits, deployment or Git push.

### Oct19 — matching reminder poses, joke replies and first-open microphone setup
- Owner requested meditation/coffee/meal reminder poses, typed and microphone joke answers, and permission when downloading. Added conservative offline reminderPose title matching: meditation→meditate, tea/coffee→coffee, meal→picnic; errands such as Buy coffee and ordinary tasks keep bell. Actual due queue and previews share selection. Rest rotation no longer interrupts a visible actual reminder; Snooze clears its pose, next queue item selects its own. Meditation/coffee have exact-stage assets; picnic still has only the existing original stage4 appearance. No new art or spend.
- Added shared JokeBubble for actual jokes and previews: type a guess or hold microphone, review dictated text, press Answer to reveal authored punchline; What? skips answering. Guesses exist only while bubble is open, never saved. This is offline interaction, not AI answer grading. Mic start stops plant speech; uses existing on-device transcription and visible errors.
- Added WelcomeMicBubble for first open (settings.welcomed false), since downloading alone cannot request macOS permission. Explains hold-to-record and on-device transcription, offers Enable microphone and Not now. Enable invokes existing native permission request without recording; denial shows System Settings guidance and Continue with typing. Choice persists and does not nag existing users. Existing microphone entitlement/usage description retained. Updated relevant first-open and joke instructions in both tester-guide HTML files; full older privacy/chat/email guide cleanup remains pending, not claimed complete.
- Extended isolated Electron QA with synthetic storage, blocked external requests and fake microphone/transcription. All13 previews, typed/dictated guess review-submit, unchanged saved data and Calendar priority passed at stages1,7,4. Actual four-item overdue reminder queue passed including meditation remaining visible beyond10sec and Snooze progression. First-open allow/deny/skip and remembered choice passed. Conservative classifier passed14 positive/negative cases. Typecheck and final vite build passed (existing bundle warning). Screenshots under docs/qa/2026-10-19/reminder-poses-joke-input. These tests do not verify physical microphone or macOS first-install permission dialog; original Tasks typing/microphone owner verification remains outstanding.
- Gracefully closed previous development app and launched latest build; native Companion window verified. No installer rebuild, push, deployment, new network calls or paid credits.

### Oct19 — beta download preparation; signing choice pending
- Owner requested deploying the app for beta downloads and continuing improvements afterward. Re-read AGENTS and full memory, inspected repository/release state. Branch remains ui-refresh-shadcn; latest existing commit04d2733, accumulated work still uncommitted. GitHub CLI read-only check confirmed gayathriswaminathan05-ai/Companion-App is PUBLIC with no existing releases. Owner explicitly chose “Publish the beta download on GitHub”. No release/tag/commit/push/upload created yet.
- Asked whether owner accepts an unsigned private/early beta or wants Apple signing first. Owner asked what signing is, then its cost/time; this is NOT approval to release unsigned or purchase Apple membership. Explained Developer ID identifies developer/integrity; notarization is Apple's malware scan, separate from App Store distribution. Official Oct19 sources: developer.apple.com/programs/enroll/ ($99/year, local price at enrollment); help/account/membership/program-enrollment/ (contact support if no confirmation24h after purchase, not a total verification guarantee); documentation/security/customizing-the-notarization-workflow (typically under1h after upload, may take longer); support.apple.com/en-us/102445 (Open Anyway, managed-Mac restrictions). Allow a few days was explicitly our planning estimate, not Apple SLA. Await final unsigned/signing choice; no payment, enrollment, terms acceptance or account changes.
- Prepared version0.1.1-beta.1, preserving0.1.0 and preflight candidate. package.json/lock version updated, build output release/0.1.1-beta.1. No app ID/data-folder change; manual app replacement preserves stable companion-app storage. Added package exclusions for keys/tokens/data/env files. beta-config remains excluded; Google desktop OAuth app registration remains bundled for approved Calendar, validated only clientId/clientSecret, no user tokens; never commit that file.
- Found local Kokoro allowed model-download fallback despite bundled/offline beta intent. Changed electron/voice.cjs to allowRemoteModels=false; bundled model path used even if incomplete, so fails locally instead of fetching. Real speech model test passed from empty temp data. Existing cloud speech/AI guards remain off.
- IMPORTANT actual minimum OS: Electron's Info.plist/framework says12.0, but packaged Whisper ONNX1.24.3 native binaries require14.0; Kokoro ONNX1.21 requires13.3. Inspected Mach-O deployment targets (sharp/libvips11.0). Final installer Info.plist now14.0 and guide/release notes say Apple-chip M1+ and macOS14 Sonoma+. First preflight claiming12 was preserved locally as release/0.1.1-beta.1-preflight-macos12 and must NOT be distributed. Rebuilt final installer with corrected requirement.
- Rewrote site/privacy.html and both docs/tester-guide HTML files for no-chat beta: local tasks/transcription/speech, optional read-only Calendar, no Gmail, first-open mic choice, jokes, breathing1/3/5min, local deletion/backup caveats, optional screen/call access, manual updates, known beta limitations and support by replying to inviter (no new public contact invented). Removed external Google Fonts from guide; standalone release privacy copy uses system font. Preserved prior wording at docs/release/archive-2026-10-19. Updated beta checklist with current release-preparation override; old planning remains historical. Original landing options/trailer still contain historical features, are not included in beta handoff, and are not published.
- Prepared docs/release/0.1.1-beta.1-notes.md and downloadable Companion-Beta-Guide.html / Companion-Privacy.html / SHA256SUMS.txt alongside DMG. ~607MB decimal (579MiB). Final DMG SHA25626af58a5aa81c6a9d722494649493d686c609c8c1f9674ad4ab0df5a2f4a912c. Package is ad-hoc sealed for integrity, NOT Apple Developer ID signed/notarized. Final codesign --verify --deep --strict and hdiutil verify pass. Do not describe ad-hoc seal as Apple signing.
- Validation: typecheck; privacy VM including reset/failure/disabled-chat guards; click-through; breathing timelines;31/31 proxy tests;17 Google tests pass (existing two bundled-client subcases skipped). Optimized renderer beta flow passed fake mic→reviewed reminder, Calendar and local legacy deletion. New check-beta-package.cjs validates11861 archive entries,6088 sprite paths, all model/audio files, disabled chat, no proxy/key/personal files, no Anthropic dependency and minimumOS14.0. Scanned app-owned code/config for credential patterns without printing credentials. Final ASAR hash47e316f9fcae47899ae42da32eeefa55b672d0cadf0537a5874edb5e88ddcceb.
- New check-packaged-beta.cjs runs actual packaged main/preload/renderer/native models using matching Electron runtime with isolated temp appData, hidden muted window, no real mic or Google. Passed first-open Not now/persistence, native inserted typed reminder6pm, reload persistence, chat/key/dev-test absence, real Kokoro PCM synthesis, real Whisper transcription from bundled recording ("settle in, let your shoulders soften. Breathe in gently."), meditation media playback, zero intercepted network calls. Production normal quit intentionally SIGKILLs; harness printed PASS then exit1 due known quit path, not a test assertion failure. No owner data touched. Final candidate's283 resource files including complete ASAR/native libraries/models match tested preflight byte-for-byte; only minimum-OS bundle metadata changed. final-equivalence.json records this.
- New check-beta-docs.cjs passed1100/390px guide/privacy layout with no overflow/broken images; screenshots visually reviewed. Initial runner closed its last window and autoquit between sizes; fixed lifecycle and reran successfully. Package audit initially expected quantized Whisper filenames; corrected to actual fp32 files. Reports/screenshots under docs/qa/2026-10-19/release-0.1.1-beta.1. A mounted preflight DMG matched audited app; unmounted after verification. Final DMG CRC verification passed.
- Remaining before/at release: owner's informed signing choice; source checkpoint on ui-refresh-shadcn matching the actual installer before tagging (do not tag old04d2733 as if it contains current changes); upload release assets and verify remote digest/link. Still no independent clean tester Mac, real mic permission/capture, actual Google test-account sign-in or long-session/sleep-wake signoff. Release notes explicitly disclose those early-beta limits; do not claim full checklist passed. Source/guide/installer prepared locally only. No paid AI generation or deployment of chat server/landing page.

### Oct19 — owner approves unsigned GitHub beta and matching branch upload
- Owner explicitly approved publishing the beta without Apple signing for now, with clear installation instructions, and uploading matching code to ui-refresh-shadcn, not main. This resolves the pending signing decision; no Apple purchase/enrollment authorized.
- Pre-publication read-only Git check: main ad58bf82a03096d4e861ba49c0f16ed30a306c13; ui-refresh-shadcn04d2733cff7cbf09565fcb18ed6e254f59ba6167; no v0.1.1-beta.1 tag/release. Rechecked exact installer archive audit; unchanged/no private files. Release notes now include the full System Settings → Privacy & Security → Open Anyway path directly.
- Preparing reviewed source/assets/docs checkpoint for beta0.1.1-beta.1, excluding keys, per-machine config, models, personal files and local intermediate art outputs. Prior art remains on disk. Final upload verification will be recorded separately after success.
