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
