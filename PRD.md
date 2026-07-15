# PRD — Desktop Companion App (working title: "Buddy")

**Author:** Gayathri
**Date:** July 14, 2026
**Status:** Draft v1 — for 2-week beta scope
**Platform:** Desktop (macOS first, Windows via same codebase)

---

## 1. Overview

A cute animated character that lives on the user's desktop all day. It manages their
to-do list, chats with them like a friend, sets reminders, and gently nudges them to
stretch, walk, and take breaks. The character reacts to what's happening with
contextual animations (writing in a notebook when adding a task, celebrating when a
task is done, sleeping late at night).

### One-line pitch
> A companion that keeps you company while you work — so you never feel alone in your journey.

### Emotional contract (the core design principle)
The character **cares for the user; the user does not have to care for the character.**
- No streaks that break. No pet that starves. No guilt mechanics.
- If the user is away for 3 days, the character says "I missed you!" — never "you failed me."
- Every feature must pass the test: *does this make the user feel accompanied, or obligated?*

### How we are different
| | Finch / Duolingo-style apps | Us |
|---|---|---|
| Interaction model | Check-in: open app → do thing → close | Ambient: present all day |
| Who initiates | User opens the app | Character notices and speaks first |
| Emotional dynamic | User cares for the pet (obligation) | Pet cares for the user (support) |
| Retention lever | Streaks, XP, guilt | Relationship, memory, presence |
| Platform | Mobile | Desktop, where work hours actually happen |

---

## 2. Goals & Non-Goals

### Goals (beta)
1. User feels genuine companionship — measurable via beta survey question: *"Did you feel less alone while working?"*
2. To-dos and reminders are trustworthy enough to actually use (zero missed reminders).
3. Character feels alive: always animating something, reacts contextually within ~1s.
4. Shippable in 2 weeks; installable by non-technical friends/family in under 2 minutes.

### Non-Goals (explicitly out of scope for beta)
- Multiple characters, cosmetics, or customization beyond a name
- Accounts, login, cloud sync, or multi-device
- Payments / subscriptions (validate feeling first; monetize later)
- Mobile app
- Speaking voice / TTS for the character (deferred post-launch; V1 has voice *input*
  + cute sounds — see Section 13)
- Mood tracking / journaling (v2 candidate)
- Calendar integration (v2 candidate)
- App usage tracking / screen-time awareness (v2; privacy-sensitive — needs care)

---

## 3. Target User & Personas

**Beta audience:** friends & family (~10–30 people), mixed macOS/Windows, mixed technical ability.

- **P1 — The remote worker (primary).** Works alone at a desk 6–10 hrs/day. Feels
  isolated. Loses track of tasks scattered across sticky notes. Forgets to take breaks.
- **P2 — The student.** Long study sessions, procrastinates, responds well to gentle
  encouragement, likes cute things.
- **P3 — The casual user (family).** Won't use to-dos much; keeps it around because the
  character is delightful. Tests whether the character alone carries the app.

---

## 4. The Character

- **v1: one character.** Species/design TBD (see Open Questions). Requirements:
  readable at small size (~120–200px), expressive without dialogue, gender-neutral.
- User can name the character during onboarding (default name provided).
- Personality: warm, playful, encouraging, a little goofy. Never preachy, never
  passive-aggressive, never guilt-tripping. Talks like a close friend, not a coach.
- Sits at a user-chosen spot on screen (default: bottom-right, above taskbar/dock).
  Draggable anywhere. Position persists across restarts.

### Animation states (v1 set)
| State | Trigger |
|---|---|
| Idle (breathing, blinking, occasional fidget) | Default; must never be fully static |
| Sleeping (zzz) | User idle >15 min, or after user-configured "bedtime" |
| Waking up | Mouse/keyboard activity after sleep |
| Writing in notebook | User adds a to-do or reminder |
| Checking off / celebrating | Task completed (bigger celebration when all tasks done) |
| Waving | App launch, user returns from long absence |
| Stretching / walking in place | Break-time nudge |
| Listening / head tilt | Chat window open, user typing |
| Thinking (tapping chin) | Waiting for AI response |
| Dragged (dangling/surprised) | User drags the character |

Animation rules:
- Contextual animation must start within ~1 second of the trigger.
- Transitions return to idle; no state should dead-end.
- Subtle randomized idle variations so it never looks looped.

### The sprout — daily growth, zero pressure
The sprout on the character's head grows through the day as the user accomplishes
things: completing tasks, finishing a focus stretch, taking a walk break, or just
having a nice conversation. Stages: tiny bud → first leaf → two leaves → full bloom.

Hard rules (this is the anti-Finch mechanic — accomplishment, never obligation):
- **It only grows. It never wilts, shrinks, or punishes.** A zero-task day ends as a
  cute bud — which is fine and never commented on negatively.
- Resets to a fresh bud each morning, framed positively ("new day, new sprout").
- No numbers, no streaks, no progress bars attached to it — it's purely visual warmth.
- Bloom thresholds are generous and slightly fuzzy (bloom should feel reachable on an
  ordinary day, not only heroic ones).
- Small sparkle animation + happy sound at each growth moment; character may remark
  once ("look, we grew a leaf today!").
- v1 implementation: sprout stage = extra overlay frames on each animation state
  (factor into sprite-sheet plan: each state needs bud/leaf/two-leaf/bloom variants,
  OR sprout rendered as a separate layered sprite on top of the body — preferred,
  keeps art work small).

---

## 5. Features & Use Cases

### F1 — Presence (the window itself)
- Frameless, transparent, always-on-top window containing only the character.
- Click-through everywhere except the character's body — **must never block clicks
  on the user's real work.**
- Right-click (or click) on character → small menu: Chat, To-dos, Reminders, Settings, Quit.
- "Focus mode": one click hides the character to the menu bar/tray for N minutes
  (screen sharing, presentations, deep focus). It returns quietly, no guilt.
- Launch at login (opt-in toggle, asked during onboarding).

Use cases:
- UC1.1 User drags character to a new corner → position saved.
- UC1.2 User starts a screen share → one click hides the pet instantly.
- UC1.3 User on single small laptop screen → character stays compact, never covers
  active window content (avoid center-screen wandering in v1).
- UC1.4 User quits app → to-dos/reminders persist; scheduled reminders fire on next launch
  if still future, or show as "missed" if past (see F4).

### F2 — Chat (talk to it like a friend)
- Click character → chat bubble/panel opens next to it. Enter sends; Esc closes.
- Powered by LLM (Claude API) with a defined personality system prompt.
- **Chat understands commands in natural language** — one input box does everything:
  - "add buy milk to my list" → creates to-do + notebook animation + confirmation
  - "remind me to call amma at 6" → creates reminder + confirmation with parsed time
  - "what's on my list?" → reads back to-dos
  - "done with the report" → marks matching to-do complete + celebration
- Anything that isn't a command is friendship: venting, celebrating, small talk.
- Character occasionally initiates (see F5), max ~3 unprompted messages/day.

Use cases:
- UC2.1 User vents about a bad day → empathetic response, no unsolicited productivity advice.
- UC2.2 User says "remind me to call amma at 6" → confirms "6:00 PM today, got it!"
  (always echo the parsed time — silent misparse destroys trust).
- UC2.3 Ambiguous time ("remind me later") → character asks one clarifying question.
- UC2.4 No internet / API down → character still works for to-dos & reminders (local
  parsing fallback); chat says "I'm having trouble thinking right now 😅" — never a raw error.
- UC2.5 User asks something outside scope (weather, web) → charming honesty: "I can't
  check that yet, but it's on my wishlist!"
- UC2.6 User writes in another language → respond in that language (LLM handles free;
  worth testing with family).
- UC2.7 Distress conversations — tiered response. **Required before beta ships —
  friends & family will test this boundary, jokingly or not.**
  - **Tier 1 — everyday struggles** (bad day, stress, loneliness, breakup, failed exam):
    respond like a caring friend — listen, empathize, offer gentle friendly advice and
    small next steps ("want to take a walk and tell me about it?"). Never deflect to a
    helpline for ordinary sadness; that feels dismissive and breaks the friendship.
  - **Tier 2 — life-threatening distress** (self-harm, suicidal thoughts, danger to self
    or others): stay warm and present, don't lecture or panic, and gently point to real
    help — local helpline numbers (e.g., iCall / AASRA in India, 988 in the US) and
    encourage reaching out to someone they trust. The character stays with them in the
    conversation; it never just drops a number and changes the subject.
  - In both tiers: never claim to be a therapist, never diagnose, never give medical
    advice. Tier detection and tone live in the personality system prompt; test with
    scripted scenarios before shipping.

### F3 — To-do list
- Add via chat (primary) or via a minimal list panel (checkbox, text, delete).
- Complete → checked + celebration animation. All done today → bigger celebration.
- Tasks are a simple flat list for v1 (no projects, tags, priorities, due dates —
  a task that needs a time is a reminder).
- Incomplete tasks roll over silently. No "overdue" red badges. If a task lingers
  ~3+ days the character may gently ask about it once: "still thinking about
  'renew passport'? want to break it into something smaller?" — supportive, not nagging.
- Local storage (JSON/SQLite). Survives restarts. Export/import not in v1.

### F4 — Reminders
- Created via natural language in chat; time parsing for: absolute ("at 6pm"),
  relative ("in 40 minutes"), tomorrow/day names ("tomorrow at 9", "on Friday").
- Recurring reminders: v1 supports daily only ("every day at 10") — weekly/custom is v2.
- Delivery: character walks to front of attention + speech bubble + system notification
  (both, so it works when user is in a fullscreen app).
- Snooze (10 min) and Done actions on the reminder bubble.
- Missed reminders (app was closed / machine asleep at fire time): on next launch,
  show gathered "while you were away" summary — never silently drop.
- All reminders visible/deletable in a simple list panel.

Edge cases:
- UC4.1 Machine asleep at fire time → fire on wake with "this was for 6:00" note.
- UC4.2 Two reminders same minute → queue bubbles sequentially, both notifications fire.
- UC4.3 User creates reminder for past time → character asks: "that time already passed —
  did you mean tomorrow?"

### F5 — Wellness nudges (proactive care)
- Stretch/walk nudge after N minutes of continuous activity (default 60, configurable
  30/45/60/90/off). Uses system idle detection — a real break (idle >5 min) resets the timer.
- Nudge = character does the stretch animation + one-line invitation ("stretch with me?").
  **Dismissable in one click. Never modal. Never repeated within 15 min.**
- Water reminder (optional, off by default; every 2 hrs when on).
- Late-night care: after user-configured bedtime, character gets sleepy, yawns, and
  eventually sleeps — the nudge is the vibe itself, plus max one gentle line
  ("I'm sleepy… don't stay up too late, okay?"). Never repeats.
- Celebration triggers: first task of the day, all tasks done, user returns after days away
  (warm welcome, zero guilt).

Anti-annoyance guardrails (critical — this is where companions get uninstalled):
- Global cap: max ~4 proactive interactions/day (excluding user-set reminders).
- Every proactive feature individually toggleable in Settings.
- Do-not-disturb: auto-suppress nudges during focus mode / while hidden.

### F6 — Memory (the "you're not alone" engine)
- Rolling conversation summary + small structured memory (name, things they mentioned:
  exam Friday, presentation, trip) stored locally, injected into the system prompt.
- Enables: "how did the presentation go?" the next day; remembering their preferences.
- v1 scope: last ~7 days of context + persistent facts. No vector DB needed.
- Privacy: all data stays local except chat messages sent to the LLM API. State this
  plainly in onboarding — family will ask "is it listening to me?" The answer must be
  an easy no (we read keyboard/mouse *idle timing* only, never content).

### F7 — Onboarding (first run)
1. Character walks in, waves, introduces itself.
2. Asks user's name → asks what user wants to call *it* (default offered).
3. 20-second guided tour via chat: "tell me something to remember, like 'remind me to
   drink water in an hour'" — first reminder created as part of onboarding.
4. Asks: launch at login? bedtime? break interval? (defaults offered, all skippable).
- Total time < 2 minutes. Skippable entirely.

### F8 — Settings (spec finalized July 2026 after Finch/Mobbin pattern review)
All copy written in Blob's voice (Finch pattern: settings stay in-character).
**v1 sections:**
- 🌱 companion: Blob's name, your name, sounds on/off (+volume later)
- 💛 care: stretch interval (off/30/45/60/90), water on/off, bedtime on/off+time,
  jokes off/3h/rare — every nudge individually controllable, named in Blob's voice
  ("let me check on you", "when should I get sleepy?")
- 🧠 memory: "what I remember about you" — view & DELETE individual facts
  (differentiator: visible/touchable privacy), clear chat history
- ⚙️ app: launch at login, API key change/remove (beta only)
- 🔒 privacy: policy link, delete everything (confirm)
- ℹ️ about: version, feedback link
**Baked-in behavior (from Finch's "day boundary")**: sprout/day resets at 4am,
not midnight — 1am accomplishments count toward "today".
**Later:** companion size, personality loudness (paid candidate), quiet hours,
appearance light/dark, language, subscription section (Day 11).

---

## 6. Technical Requirements

- **Stack:** Electron + TypeScript + React (fastest 2-week path, one codebase for
  macOS + Windows; Tauri considered — better footprint, but Electron's maturity wins
  for a 2-week deadline). Decision locked unless prototype shows blocking issues.
- **Animation:** sprite sheets (PNG frame sequences) rendered on canvas, or Rive if
  character is vector. Decision follows character art style (Open Question #1).
- **AI:** Claude API (`claude-sonnet-5` for chat quality; drop to `claude-haiku-4-5`
  if cost matters later). Developer's API key baked into beta build via a tiny proxy
  (never ship a raw key in the binary) OR key entered in settings for technical testers.
  Beta cost estimate: ~30 users × light chat ≈ a few $/week.
- **NL time parsing:** LLM tool-use for parse + local library (e.g., chrono-node) as
  offline fallback. Always echo parsed result to user.
- **Storage:** local JSON or SQLite in the app data directory.
- **Performance budget:** <1% average CPU when idle-animating, <300MB RAM,
  no fan spin-up. Pause/slow animations when character is hidden or machine on battery-saver
  if easy.
- **Distribution:** macOS — signed + notarized DMG (requires Apple Developer account,
  $99 — start this on day 1, notarization setup has lead time). Windows — unsigned
  installer with a "click through SmartScreen" instruction note for beta.
- **Auto-update:** out of scope for beta; testers reinstall from a shared link.
- **Crash/error logging:** minimal local log file + "share logs" button for beta debugging.

---

## 6b. Privacy Policy (binding design constraints)

Non-negotiable rules — every feature must comply or it doesn't ship:

1. **Local-first by default.** To-dos, reminders, settings, sprout progress, chat
   history: stored only on the user's device. No cloud copies, no sync, no backups
   on our servers.
2. **Voice never leaves the device.** Whisper runs locally; audio is processed
   in-memory and discarded. We never store or transmit recordings.
3. **Chat is the ONLY network flow.** Message text goes to the Claude API solely to
   generate a reply. Proxy rules: no content logging or storage; anonymous device ID
   only (no accounts/emails/names); TLS everywhere; per-device rate caps. Under
   Anthropic API terms, chats are not used for model training and are deleted from
   their systems after a limited retention period.
4. **No tracking.** No analytics SDKs, no ad IDs, no third-party trackers. Future
   usage stats (Section 11 Layer 2): opt-in, default OFF, anonymized, never chat
   content.
5. **User control.** "Delete everything" in Settings wipes all local data instantly.
   No data survives uninstall + delete.
6. **Plain-language privacy policy** ships with the beta (one page, no legalese)
   stating all of the above; also required later for Mac App Store listing and
   GDPR/India DPDP alignment.
7. **Distress conversations get no special storage** — same local-only handling; we
   never see them.

## 7. Success Metrics (beta)

Qualitative (survey after ~1 week of use, plus a mid-week check-in):
1. **"Did you feel less alone while working?"** — the north-star question.
2. "Did the character ever annoy you? When?" — anti-metric; any yes gets investigated.
3. "Did you trust it with reminders?" — zero tolerance for missed reminders.
4. "Would you be sad if it disappeared tomorrow?" — the keeper question.

Quantitative (local counters, shared via feedback — no analytics service in beta):
- Days active in week 1 (target: 5+/7 for half of testers)
- To-dos created; reminders created; chats initiated by user
- % of testers who disable nudges (if >30%, defaults are wrong)

## 8. Risks

| Risk | Mitigation |
|---|---|
| Character is cute for 2 days, then invisible (novelty cliff) | Memory + proactive moments are the retention core, not the art; measure day-5 usage |
| Nudges feel naggy → uninstall | Hard caps, one-click dismiss, everything toggleable, bedtime nudge fires once |
| Missed reminder destroys trust instantly | Local scheduling (not server), fire-on-wake, "while you were away" recovery |
| Animation art takes longer than code | Lock a simple art style; 10 states max; placeholder art acceptable for week-1 build |
| API cost/abuse in beta | Proxy with per-user daily message cap (e.g., 100 msgs/day) |
| macOS notarization delays ship day | Start Apple Developer enrollment day 1 |
| Chat says something off-tone (it's a friend, one bad reply hurts) | Tight personality prompt + distress protocol (UC2.7) + beta testers told to screenshot weird replies |

## 9. Two-Week Plan (summary)

**Week 1 — the body:** window shell (transparent, always-on-top, click-through, drag),
character rendering + idle/sleep/write/celebrate animations with placeholder art,
to-do list + local storage, reminder engine + notifications, panels/menus.

**Week 2 — the soul:** Claude chat + personality prompt, NL command parsing (todos/
reminders via chat), memory, wellness nudges + remaining animations, final art pass,
onboarding, settings, packaging/signing, install test on 2 machines, ship to testers.

## 10. Open Questions

1. **Character design:** species & art style (pixel? soft vector blob? hand-drawn animal?).
   Drives the animation pipeline choice — decide before Day 3.
2. **Name of the app + character default name.**
3. Beta testers: exact list, and how feedback is collected (form vs. group chat).
4. Does the character speak with occasional Hinglish/Tamil warmth for family testers,
   or English only? (Cheap to support via prompt; nice differentiation.)
5. Bedtime default (11 PM?) and whether late-night care ships in beta or v2.

## 11. Self-Learning Roadmap (adapts as users grow)

The app gets smarter in three layers; only Layer 1 foundations are in the beta.

**Layer 1 — Per-user adaptation (foundation in beta, deepens in v1.x).**
The character learns each user individually — no ML infrastructure required, just
memory (F6) + behavioral signals injected into the prompt:
- Rhythm: learns active hours, adapts sleep/greeting/check-in timing to the user.
- Nudge response: tracks dismissed vs. acted-on nudges per type & time of day;
  auto-quiets what gets ignored ("you never stretch before noon — I'll stop asking").
- Tone: learns whether user responds to playful vs. gentle vs. brief encouragement.
- Task patterns: notices recurring manual tasks and offers to make them automatic
  ("you add 'water plants' every Sunday — want me to just remind you weekly?").
- Beta scope: memory + a simple nudge-response counter. The rest is v1.x.

**Layer 2 — Product-level learning (post-beta, as users increase).**
Aggregate, opt-in, anonymized telemetry → weekly prompt/feature iteration:
- Behavioral events only (nudge dismissed, reminder parse failed, feature used).
- **Never chat content.** Chat text never leaves the AI request path; it is never
  logged server-side or used for training.
- Drives: better default nudge timing, better time-parsing, personality tuning.
- Requires updating the privacy promise: "all data local" becomes "all personal data
  local; optional anonymous usage stats — never your conversations" with an explicit
  opt-in toggle in Settings (default off in beta).

**Layer 3 — Custom model training: deliberately NOT on the roadmap.**
Fine-tuning on user conversations is a privacy landmine (users share intimate things),
expensive, and outperformed by frontier models + good prompts + per-user memory at
this scale. Revisit only at very large scale, if ever, and only with explicit consent.

## 12. Monetization: Free vs. Paid Plan

Two design rules: (1) the only marginal cost is AI chat — cap that, give away
everything local; (2) **never paywall the kindness** — free users get a real friend
with a smaller brain, never a cold or guilt-tripping demo.

**Pricing (July 2026 decision):** 7-day full trial (no card upfront) → $6.99/mo or
$49.99/yr. Unit economics @ Sonnet-class chat model: avg user COGS ~$2.35/mo + ~$0.50
payment fees → ~59% margin monthly; heavy users capped by 100 msgs/day fair-use so no
subscriber is loss-making. After trial the app NEVER dies: all zero-marginal-cost
features stay free forever (tasks, reminders, nudges, sprout, voice input, canned
jokes) — paid re-awakens the brain (chat, memory, research, adaptive care).

| | Free — "the companion" | Paid — "the best friend" ($6.99/mo or $49.99/yr) |
|---|---|---|
| Character, animations, presence | ✅ Full | ✅ Full |
| To-dos & reminders | ✅ Unlimited (zero marginal cost; the daily-habit hook) | ✅ Unlimited |
| Chat | 15 messages/day | **Unlimited** (headline feature) |
| Memory | Short-term (~last 7 days) | **Long-term — remembers everything** (emotional flagship) |
| Wellness nudges | Standard schedule | **Adaptive care** (learns your rhythm & tone — Layer 1) |
| Telegram bridge (v1.5) | — | ✅ Companion texts you when away |
| Cosmetics / seasonal outfits / future characters | — | ✅ As they ship |

Framing: free = utility, paid = relationship depth. Trial-end message stays
in-character and fair: "I'll still be here every day; I just won't remember as far back."

### Trial
- 7-day full-experience trial from first launch.
- Day 6: gentle in-character heads-up. Day 8: graceful downgrade to free — never a
  lockout, never a personality change.

### Beta approach (2-week build)
- Build the trial countdown + paywall screen with real pricing; **do NOT build payment
  processing** (Stripe etc. is v1.1, ~3-4 days of work that would blow the timeline).
- "Subscribe" clicks during beta are logged as the willingness-to-pay signal, then a
  founder code unlocks the full app for testers — their feedback is worth more than $5.
- Real payments ship in v1.1 once the beta validates the product.

## 13. V2 Parking Lot (do not build now)

Multiple characters & cosmetics (monetization path), weekly recurring reminders,
calendar integration, mood check-ins, voice, screen-time awareness, phone companion app,
sync, marketplace/licensed characters, subscriptions (Finch-model freemium).

**Voice — V1 scope decided:**
- **V1 — voice input:** mic button in the chat bubble; user talks, character replies
  in text. Implementation options (pick cheapest reliable during build): local
  whisper.cpp, cloud Whisper-class STT via the proxy (~fractions of a cent/min), or a
  native macOS speech helper. Adds ~1–1.5 days to Week 2 — accepted into scope.
- **V1 — cute character sounds (Animal Crossing style):** short pre-recorded
  chirps/trills for key moments — wave hello, task celebration, sleepy yawn, reminder
  pop. No TTS, no API, no latency; sounds feel MORE alive than robotic speech.
  - Global sound toggle in Settings (default ON, volume modest); auto-muted during
    focus mode / screen-share hide.
  - Max ~6 sounds in V1; sourced royalty-free or custom-made to match the character.
- **Later (post-launch, revisit deliberately):** real speaking voice (quality TTS,
  paid tier, lip-sync animation). Explicitly deferred until the full app is built and
  validated. System (robotic) TTS remains rejected at any stage.

**Global launch (decided: yes, from v1):** direct download is worldwide by default.
Payments via a Merchant of Record (Paddle or Lemon Squeezy) — they handle global
taxes/currencies/compliance and pay out to India (export income). Privacy design
already GDPR/DPDP/CCPA-aligned. v2 growth levers: UI localization (JP/KR cozy-app
markets especially), multilingual chat (near-free via prompt), regional pricing.

**v1.5 committed — mobile gap bridge (before building a phone app):** deliver reminders
beyond the laptop via a messaging bot in the character's voice ("don't forget —
call amma at 6 💛"), and accept quick to-do adds from the phone that sync to the desktop
list. Covers most of the mobile value at a fraction of the cost; a full mobile companion
app only gets built if beta proves people love the character.
- **Telegram first:** free Bot API, no approval process, minutes to set up — right for beta scale.
- **WhatsApp later:** needs Meta Business API approval + per-message fees; revisit at real
  user scale (matters for India, where family lives on WhatsApp).
- Not in the 2-week beta build — first fast-follow after beta feedback.
