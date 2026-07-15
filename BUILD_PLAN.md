# Build Plan — Desktop Companion App (2-Week Beta)

Companion to [PRD.md](PRD.md). Each day has a **Definition of Done** — if it's met,
move on; if not, use the buffer days, don't slip silently.

---

## Day 0 — Decisions (before writing code)

Blockers that gate the build; settle these first:

- [ ] **Character concept & art style** — ONE character for v1; candidates: hedgehog
      or penguin. Gates the animation pipeline (Day 2) and sound identity (Day 7).
- [ ] **App name + character default name.**
- [ ] **Art plan: self-generated animations** (Gayathri makes them). Generate the
      sprite sheets alongside Week 1 coding — placeholders unblock all code; final art
      must be ready for Day 12 integration. Keep every state at identical canvas
      dimensions and a consistent style/seed so frames match.
- [ ] Create the repo; set up Claude API key for later.

**Deferred, with a deadline:** Apple Developer enrollment ($99) — takes 24–48h;
**must be started by Day 10** so approval lands before Day 13 notarization.

---

## WEEK 1 — The Body (everything local, no AI yet)

### Day 1 — The window shell
- Scaffold: Electron + TypeScript + React + Vite; electron-builder configured from day one.
- Frameless, transparent, always-on-top window pinned above the taskbar/dock.
- **Click-through everywhere except the character's body** (the make-or-break
  mechanic — `setIgnoreMouseEvents` with forwarding; verify clicks pass through to
  apps underneath).
- Drag the character anywhere; position persists across restarts (electron-store).
- ✅ **Done when:** a placeholder square sits on the desktop, stays on top, drags,
  remembers its spot, and never blocks a click outside itself. Test on macOS; smoke-test
  a Windows VM if available.

### Day 2 — Animation engine
- Sprite-sheet renderer on canvas (or Rive runtime if the art style is vector — decide
  per Day 0).
- Animation state machine: idle (+2 random variations), sleeping, waking, writing,
  celebrating, waving, stretching, listening, thinking, dragged. All states loop or
  return to idle; nothing dead-ends.
- Placeholder art for every state (rough is fine; same dimensions as final art).
- Performance check: <1% average CPU while idling, no fan spin-up.
- ✅ **Done when:** you can trigger every state from a debug menu and idle never looks
  frozen or looped.

### Day 3 — Panels, menus, storage
- Click character → speech-bubble menu: Chat, To-dos, Reminders, Settings, Quit.
- Chat bubble UI shell (input box, message list — not wired to AI yet).
- To-do panel: add / check / delete; celebration animation on complete; bigger one when
  all done today.
- Local storage layer (electron-store JSON): todos, reminders, settings, position.
- ✅ **Done when:** you can add and complete a to-do, the character visibly writes it
  down and celebrates, and everything survives a restart.

### Day 4 — Reminder engine (the trust-critical system)
- Scheduler: absolute ("6pm"), relative ("in 40 min"), tomorrow/day-names, daily
  recurring. (Manual creation UI for now; NL parsing arrives Day 9.)
- Delivery: character animation + speech bubble + system notification (both, for
  fullscreen apps). Snooze 10 min / Done actions.
- **Missed-reminder recovery:** fire-on-wake after sleep with "this was for 6:00" note;
  "while you were away" summary on launch. Past-time reminders never silently dropped.
- Edge cases from PRD: two reminders same minute (queue), reminder in the past (reject
  at creation for now).
- ✅ **Done when:** a reminder set for 2 minutes out fires while you're in a fullscreen
  app, and one that "fires" while the laptop lid is closed appears on wake, labeled.

### Day 5 — Wellness nudges + presence features
- System idle detection (`powerMonitor`); break timer (default 60 min, configurable;
  real break >5 min resets it).
- Stretch/walk nudge: animation + one-line invitation; one-click dismiss; never modal;
  15-min repeat suppression; global cap ~4 proactive interactions/day.
- Bedtime sleepiness (yawn → sleep; max one gentle line). Water reminder (off by default).
- Focus mode: one click hides to menu-bar/tray for N minutes; nudges auto-suppressed.
- Launch at login (opt-in).
- ✅ **Done when:** the character nudges you after the interval, shuts up when
  dismissed, and vanishes instantly for a screen share.

### Days 6–7 — Settings, sounds, buffer
- Settings panel: names, nudge toggles, intervals, bedtime, sounds on/off + volume,
  launch at login, delete-all-data, feedback link.
- **Cute sounds:** ~6 chirps (hello, celebrate, yawn, reminder pop, +2); consistent
  pitch/instrument family; auto-mute when hidden. Royalty-free or custom.
- Local crash/error log file + "share logs" button.
- **Buffer:** finish anything that slipped. Week 1 must be fully done before Week 2 —
  the AI layer builds on all of it.
- ✅ **Week 1 exit test:** run it as your real to-do/reminder app for a full workday.
  If YOU wouldn't keep it running, fix that before adding the brain.

---

## WEEK 2 — The Soul (AI, voice, packaging)

### Day 8 — Chat brain
- **Proxy first:** tiny Cloudflare Worker (or similar free tier) holding the Anthropic
  API key; per-device daily message cap (e.g. 100). Never ship a key in the binary.
- Wire chat bubble → proxy → Claude; streaming replies into the bubble; listening/
  thinking animations during the round trip.
- Personality system prompt v1: warm, playful, never preachy/guilt-tripping; includes
  the two-tier distress protocol (PRD UC2.7).
- Offline/API-down: "I'm having trouble thinking right now 😅" — never a raw error.
- ✅ **Done when:** you can have a genuinely pleasant 10-message conversation and a
  killed network degrades charmingly.

### Day 9 — Natural-language commands (tool use)
- Claude tool-use schema: `add_todo`, `complete_todo`, `list_todos`, `set_reminder`,
  `list_reminders`, `delete_reminder`.
- Wire tools to Day 3–4 systems + contextual animations (notebook-writing on add, etc.).
- **Always echo parsed times** ("6:00 PM today, got it!"); ambiguous → one clarifying
  question; past time → "did you mean tomorrow?"
- chrono-node local fallback so reminder creation works offline.
- ✅ **Done when:** "remind me to call amma at 6" and "done with the report" both work
  end-to-end through chat, with the right animations.

### Day 10 — Memory + safety testing
- ⏰ **Last day to start Apple Developer enrollment** (needed for Day 13).
- Rolling conversation summary (last ~7 days) + persistent facts file (name, mentioned
  events, preferences) injected into the system prompt.
- Nudge-response counter (Layer 1 learning seed): log dismissed vs. acted-on per type.
- **Scripted safety tests:** run the Tier 1 / Tier 2 distress scenarios from the PRD +
  a few joke variants; tune the prompt until responses land right. This must pass
  before beta ships.
- ✅ **Done when:** it asks "how did the presentation go?" the next morning, and all
  distress scripts produce warm, correctly-tiered responses.

### Day 11 — Voice input + trial/paywall
- Mic button in chat bubble → record → STT (cheapest reliable: Whisper-class API via
  the proxy; local whisper.cpp if time allows) → text into the normal chat flow.
- Trial system: 7-day full-experience countdown; day-6 in-character heads-up; paywall
  screen with real pricing; "Subscribe" clicks logged (willingness-to-pay signal);
  founder code unlocks everything. **No payment processing** (v1.1).
- Free-tier caps wired: 15 msgs/day post-trial, short-term memory only.
- ✅ **Done when:** spoken "add milk to my list" creates the to-do, and a
  clock-advanced machine shows the day-6 notice → paywall → founder code path.

### Day 12 — Art, sound & onboarding polish
- Integrate final character art across all states (this is why the artist was briefed
  Day 0). Sound pass matched to the character.
- Onboarding: character walks in, waves, asks names, guided first reminder, asks
  launch-at-login / bedtime / break interval. <2 min, skippable.
- App icon, menu-bar icon, paywall/trial copy pass.
- ✅ **Done when:** a fresh install feels delightful from first launch to first reminder.

### Day 13 — Packaging & install testing
- **Bundle the Whisper voice model (~40MB) inside the installer** (point
  transformers.js at the packaged model path) — voice must work offline on first
  launch with zero downloads. Test on a machine with Wi-Fi off.
- macOS: electron-builder → signed + **notarized** DMG (Apple account from Day 0).
- Windows: installer + SmartScreen click-through instructions note.
- Clean-machine install tests (or fresh user account): onboarding → todo → reminder →
  chat → voice → quit/relaunch persistence.
- Kill remaining crashes; verify log-sharing works.
- ✅ **Done when:** a non-technical person can go from download link to talking
  companion in under 2 minutes with no help.

### Day 14 — Ship the beta
- One-page plain-language privacy policy (from PRD §6b) included with the download
  and linked in Settings.
- Feedback channel: Google Form (PRD survey questions) + WhatsApp/Telegram group.
- Welcome note: what it is, what to try, how to report weirdness ("screenshot anything
  the character says that feels off").
- Send to 5 testers first, watch for fires for a few hours, then the rest.
- Schedule: mid-week check-in ping + day-7 survey.
- 🎉 **Shipped.**

---

## If you fall behind — cut order (last → first)

Cut from the bottom of this list first; the top is untouchable:

1. **Untouchable:** window shell, click-through, to-dos, reminders + recovery, chat +
   personality, distress protocol, anti-annoyance caps, notarized install.
2. Memory depth (ship facts-only, no rolling summary)
3. Trial/paywall (beta can run fully unlocked; test pricing via survey instead)
4. Voice input (v1.1 fast-follow)
5. Sounds (v1.1)
6. Water reminder, bedtime sleepiness, onboarding polish

## Post-beta queue (already committed)

1. v1.1: payments (Stripe/Paddle), fixes from feedback, anything cut above
2. v1.5: Telegram bridge (reminders out, quick-adds in)
3. v2: character's real voice (paid tier), cosmetics, weekly recurring reminders
