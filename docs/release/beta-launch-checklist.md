# Private beta launch checklist

> **24 October beta.4 correction:** Every completed or skipped care setup now opens the guided tour automatically, including replayed setup. Published beta.4 is linked in Companion Product Studio. Full setup regression and packaged-app checks passed; independent tester-Mac validation remains pending.

> **24 October beta.3 update:** Owner approved the new onboarding and guided tour release on ui-refresh-shadcn. Installer, guide and privacy document are published in GitHub release v0.1.1-beta.3; same-Mac automated package checks and remote checksum verification passed. Independent tester-Mac permissions/Calendar checks remain pending. Publication result is recorded in CLAUDE.md.

**Current status note · 24 October 2026:** This file preserves earlier planning and superseded status updates. The public GitHub beta **0.1.1-beta.2 was published on 19 October** after explicit approval to include the Google Desktop registration. The earlier upload block below is resolved. Current beta has **no AI chat**, local voice and optional read-only Calendar; Google verification remains unsubmitted in the latest recorded check. For the consolidated current state and remaining work, read [the collaboration handover](../collaboration/2026-10-24/Companion-Project-Handover.md). Earlier chat gates and “no release exists” passages are historical.

Prepared for Gayathri · 17 October 2026 · Branch: ui-refresh-shadcn

This checklist is for a small, invited Mac beta, not a public launch. It records requirements, not a fresh test report. An unchecked box means we still need evidence or a decision; it does not automatically mean the feature is broken. I handle the code and checks; Gayathri approves product choices, costs and distribution.

**Release rule:** complete the required checks below on the exact installer we will send. A broken optional feature can be left out, with matching instructions. Do not ship known data loss, missed reminders in supported conditions, misleading privacy claims, exposed keys, uncontrolled AI spending, or an app that testers cannot open.

## Release preparation update · 19 October 2026

Candidate: **0.1.1-beta.2**, Apple-chip Macs, **macOS 14 (Sonoma) or later**.
The dictation native library requires14.0, even though Electron itself advertises12.0.
The earlier sections below preserve historical planning; chat/provider spending gates
are deferred and must not be treated as current beta requirements.

- Owner approved a publicly accessible GitHub beta download and unsigned installation.
  Source532777e and tagv0.1.1-beta.1 were uploaded to ui-refresh-shadcn, not main.
  Installer upload was rejected by automatic approval review because the bundled
  Google client configuration contains clientSecret. No draft or published release
  exists. Need authenticated Console verification of Desktop client type before
  retrying with that evidence or requesting explicit configuration distribution.
- New candidate beta.2 adds random OAuth state validation and S256 PKCE; rejects
  unrelated callbacks and handles fast denial. Offline loopback tests passed.
  beta.1 is preserved as an unpublished candidate and must not be distributed.
- Owner approved publishing without Apple Developer ID signing/notarization, with
  clear installation instructions, and uploading matching code to ui-refresh-shadcn.
  No Apple membership purchase, agreements or signing setup has been authorized.
- Current privacy page and both tester-guide files now describe the no-chat beta,
  local voice, optional read-only Calendar, first-open microphone choice, manual
  updates, support via the beta inviter and honest limitations. Previous wording
  retained under docs/release/archive-2026-10-19. Original landing options/trailer
  still contain historical features and are not part of this beta handoff.
- New versioned installer built with bundled models; old installer preserved.
  Package inspection excludes owner keys/tokens/data and proxy credentials.
  Google desktop OAuth app registration remains bundled as required for Calendar;
  it contains no user access/refresh tokens and is still excluded from Git.
- Typecheck, privacy/reset/chat-disabled guards, click-through, breathing timeline,
  all31 server checks and17 Google checks pass (two existing bundled-client
  subcases skipped). Optimized renderer beta flow passes.
- Isolated run of actual packaged main/preload/renderer code and models passed
  typed reminder save/reload, real Kokoro speech, real Whisper transcription of a
  bundled recording, meditation playback, first-open Not now, hidden chat/dev tools,
  and zero intercepted network requests. This is the same Mac with sample data,
  not an independent clean tester Mac. Normal production quit intentionally sends
  SIGKILL; the harness records PASS before that expected teardown.
- Still needs first tester confirmation: downloaded-app opening, real microphone
  permission/capture, Calendar sign-in, long sessions and sleep/wake. Published
  notes must retain these limitations. No claim that every checklist box passed.
- No automatic updater or automatic diagnostic upload. Replacing the application
  preserves the stable companion-app data folder. Public support contact/form is
  not supplied; invited testers reply to their inviter.

## Current scope override · Oct17, reminders-first beta

Owner approved a beta without chat, retaining Google Calendar alerts, typed and
on-device dictated tasks/reminders, wellness, meditation, jokes and growth.
Earlier chat-tone, provider-key and chat-budget gates below are deferred, not
requirements to enable chat for this release. Google remains included and optional.
The current development build blocks AI chat even with old keys/consent and omits
proxy credentials from packaging. A new installer has not yet been built or signed off.

- [x] Hide Chat and key controls; enforce the no-chat gate in the main process.
- [x] Keep task dictation, reminder parsing, Google controls and Calendar alerts.
- [x] Offline renderer checks: microphone capture with synthetic transcription,
  review before save, timed reminder, Calendar event displayed but not persisted.
- [ ] Owner reviews the development app and tests actual microphone recognition.
- [ ] Update public privacy text and tester guide for this scope (next check-ins).
- [ ] Build and inspect the exact installer; test on a clean supported Mac.
- [ ] Define failure handling: restart/recovery, readable errors, a feedback contact,
  and user-reviewed technical diagnostics excluding tasks, recordings and events.
  Do not add automatic uploads or remote analytics. Reporting flow is not built yet.

## What we already know

- Gayathri confirmed that meditation voice and music play after the Start-button fix.
- Gayathri confirmed that the plant stays visible over a full-screen Finder window.
- Earlier automatic checks passed for 1/3/5-minute meditation, pause/resume/completion, self-paced mode, reminder creation and small-plant button clicks.
- All 31 chat-server tests passed previously using simulated AI responses. This does **not** prove that real OpenAI chat works.
- A.2.0 and B.2.0 exist alongside the original pages. The newer pages omit email; the originals and old trailer still need cleanup.
- Recent changes have been tested in the development app. They still need to reach and pass checks in the tester installer.

## 1. Decide exactly what this beta includes

- [ ] Agree the first tester group, beta duration and a maximum AI spending allowance. Start with a small group before widening access.
- [ ] Confirm the promise: a desktop plant for tasks, gentle care breaks and companionship, with AI-friend chat and guided breathing. No therapy, diagnosis or clinical treatment claims.
- [ ] Confirm which Mac models and macOS versions are supported. Current packaging targets Apple-chip Macs. Verify the actual minimum macOS version; do not rely on the existing landing-page “macOS 12” text.
- [ ] Choose the page and app name testers will see. A clearly approved working name is sufficient for a private beta; final branding can wait.
- [ ] Decide whether optional Google Calendar is included in this batch. Gmail stays disabled.
- [ ] Approve the everyday plant voice and chat tone. Keep local voice for this beta unless a separate cloud-voice/privacy change is explicitly approved.
- [ ] Record the already-requested decision about the ✦ Showcase in testers' installers. Do not ask repeatedly or remove it without approval. Keep the owner's growth bar and debug menu in the development app.

## 2. Privacy and control: required before sharing

**Oct17 development progress:** Chat stays a core feature, with no on/off switch, per Gayathri's latest decision. A one-time sharing introduction precedes the first chat. Prompts now exclude task lists, profile names, saved notes, growth and old summaries. Only recent conversation (up to16 messages, including the new message) and local time are sent. Offline tests cover consent, drafts, cancellation, deletion and late replies. All speech is forced local. `site/privacy.html` explains the current boundary. These are development-app checks; final installer, live server/provider settings and guide alignment remain pending.

- [ ] Decide and implement exactly which personal context chat may send. Do not silently send task text while promising that only the message typed into chat leaves the Mac.
- [ ] Explain AI chat and its data sharing before the tester's first message; opening chat or typing a draft sends nothing, and local features do not require sending a chat.
- [ ] Verify no AI request starts before the first-chat sharing notice is accepted and a message is sent. Background helper requests stay disabled. Clearing history cancels the current reply and ignores late results; previously sent information cannot be recalled.
- [ ] Keep microphone transcription and speaking voice on the Mac for this beta. Confirm the installer has cloud speech disabled, including fallback paths.
- [ ] Verify fetched calendar details never enter AI prompts or permanent app storage. Any calendar connection is separately optional and explained.
- [ ] Verify there is no automatic upload of conversations, task contents, recordings, screenshots or diagnostic logs, and no added analytics or trackers.
- [ ] Check the deployed chat server does not record message contents. Explain the limited usage counters separately from conversations.
- [ ] Make the app, selected page, tester guide and server documentation agree that OpenAI is the only chat provider, what is sent, and how deletion works. Remove outdated email and cloud-speech descriptions.
- [ ] Replace absolute “never stored” or guaranteed-deletion wording with verified provider/account terms. `store: false` alone is not proof of zero retention. Claim Zero Data Retention only after approval and eligibility are verified.
- [ ] Test clearing chat history, deleting remembered facts and “delete everything,” including after restart. Explain what each removes and what it cannot delete from a provider's systems.
- [ ] Test disconnecting Google and removing a personal AI key. Inspect the release for keys, owner data and private files without printing secrets in logs.
- [ ] Ask for microphone, notifications and optional screen access only when needed. Denying access must leave the rest of the app usable. Automatic background matching must remain opt-in.

## 3. Real ChatGPT and a controlled bill

**Known gaps:** the real OpenAI path and personality check are pending; existing device limits are not a dependable total spending ceiling.

**Oct17 provider removal:** App/source/config are now OpenAI-only, and all31 revised server tests pass. The owner authorized deletion of the local Claude key and the Worker's ANTHROPIC_API_KEY; both are verified absent. Cloudflare currently has no OPENAI_API_KEY, so beta chat is unavailable. The retired server endpoint is now removed live following explicit owner approval; verified404 on Oct17. Live version442c970b-2da0-490a-ab95-4ad44b5b0f00. Owner explicitly instructed us to leave the company account alone. A fresh installer remains separate.

- [ ] Gayathri adds her own OpenAI key privately. With her approval for the cost, run the real chat/personality checks and verify the chosen model accepts our request settings.
- [ ] Check short, warm, funny replies; practical task help; friendly banter; research with working source links; and spoken replies. Review examples with Gayathri and get tone approval.
- [ ] Test ordinary stress separately from serious danger: supportive language without diagnosis, treatment advice, dependency pressure or dismissive responses. Serious danger must encourage appropriate human help; verify any resources the app supplies.
- [ ] Confirm “remind me to call mom at 6pm” creates the correct task and shows the interpreted date/time. Ambiguous requests ask for clarification, and duplicate replies do not create duplicate tasks.
- [ ] Test disconnected internet, bad key, exhausted credits, server failures, daily limits and interrupted replies. Show friendly recovery messages; local tasks and breathing must still work.
- [ ] Measure actual usage on representative chats, including research. Set a beta budget and alerts, and verify an enforceable spending cutoff; an alert alone is not a cutoff.
- [ ] Close the known cost-control gap: failed counter storage currently lets chat continue, and simultaneous requests can undercount. Verify safe limits during failures, repeated requests and concurrent use. Do not treat a shared app password or changeable device ID as strong user authentication.
- [ ] Test the emergency chat-off procedure. It must not disable local reminders or meditation.
- [ ] After tone approval, Gayathri adds the OpenAI server secret; deploy only with her OK. The source and private beta configuration are now OpenAI-only; verify the live route before distributing the build.
- [ ] Test server-backed chat in the installed app on a Mac with no personal AI key. Testers must not need to buy credits or supply a key.
- [ ] After the migration is confirmed, coordinate removal of the company's Claude key from the server and the relevant account. Confirm authority before revoking a company key; do not affect unrelated company apps.

## 4. Tasks and reminders must be trustworthy

- [ ] Add, edit, complete and delete tasks by typing; repeat with voice input. Incorrectly recognised speech can be corrected before saving.
- [ ] Verify exact reminder times, tomorrow, daily repeat, ambiguous times, local time zones and a clock/time-zone change.
- [ ] Check the reminder bubble, sound/voice, notification, Done and Snooze. Two reminders arriving together are both handled without duplicates.
- [ ] Test a reminder while another app is full screen, while the plant is hidden, during meditation and while another panel is open. Make the intended hidden-app behavior clear.
- [ ] Test sleep/wake and quitting/reopening. Missed reminders are recovered sensibly; explain that a closed app or sleeping Mac cannot promise a live alert at the original time.
- [ ] Tasks, reminder schedules and settings survive normal quit, Mac restart and installing the next beta version. No lost or duplicated information.

## 5. Wellness, meditation and growth

- [ ] Movement offers both stretch and walk/move suggestions; each setting, including Never, works. Language accommodates different mobility needs.
- [ ] Water reminders respect the chosen interval and off switch. Movement and water both get a fair chance under the shared daily limit.
- [ ] Verify gentle daily limits, spacing between nudges and suppression during other activities. Test bedtime across midnight and sleep/wake without repeated nagging.
- [ ] Repeatedly open Breathe and start it with a normal mouse click, including with the smallest plant and near screen edges. No invisible area blocks Start.
- [ ] Run full 1-, 3- and 5-minute sessions in the installer, not just shortened checks. Voice, music, timer and guidance stay aligned; the plant keeps its meditation pose.
- [ ] Test Pause, Resume, Stop, completion and starting again. Closing/hiding the panel, a reminder or Mac sleep must not leave orphaned audio playing.
- [ ] Check My own pace, voice/music switches and volume. Own pace stops wave animation; reduced-motion preferences are respected; music does not drown out guidance.
- [ ] Set one-off and daily meditation reminders inside Settings. They appear as tasks and fire at the right time.
- [ ] Breathing stays optional, comfortable and easy to stop, without medical claims or pressure to match a pace.
- [ ] All seven growth stages and level-ups look correct, tasks earn the intended progress, and the daily fresh start works without guilt or loss of tasks. Missing pose variants have acceptable fallbacks.

## 6. Desktop behavior and ease of use

- [ ] Repeat the owner-confirmed full-screen test in the installed app, with several apps and while switching desktops. Clicking the plant must not unexpectedly pull the user away from their work.
- [ ] Drag the plant to each edge/corner; resize plant and panels; connect/disconnect an external display. Menus, fields and buttons remain reachable.
- [ ] Clicking empty transparent space reaches the app underneath. Plant buttons work on the first click, and text fields accept typing.
- [ ] Nap/hide, return from the Dock, Quit and Start at login work predictably. No duplicate plants or reopening loop.
- [ ] If hiding during calls is enabled, it hides and returns correctly; disabling that setting keeps the plant visible. A manual hide must not be unexpectedly undone by unrelated activity.
- [ ] Check light/dark themes, readable icons, keyboard navigation, visible focus and useful screen-reader labels. Controls remain legible at the smallest supported panel size.
- [ ] Voice/sound off settings work consistently. A denied microphone permission or unavailable voice never freezes the app.

## 7. Installer, reliability and recovery

- [ ] Make a fresh installer containing the latest approved changes, with an identifiable version and date. Do not send an older development or installed copy by mistake.
- [ ] Inspect the installer contents: correct app icon, local speech models, animations, meditation recordings, correct server/provider configuration; no owner's AI keys, Google sign-in tokens, chats, tasks or personal documents.
- [ ] Install on at least one clean tester Mac/account that has never run the project. Drag to Applications, open, grant or deny permissions, quit and reopen.
- [ ] Confirm voice and meditation work without the owner's cached files or development tools, including offline use after installation.
- [ ] Decide the Apple signing route. An unsigned private beta is acceptable only if Gayathri chooses it and the supported installation steps are verified and explained clearly. Do not describe it as Apple-verified or ask users to disable Mac security globally.
- [ ] Use the app through a normal work session and sleep/wake cycle. No repeated crashes, freezes, stuck voice, excessive fan activity or worsening memory use.
- [ ] Run the final build and relevant checks, including all 31 existing chat-server tests. Record results against the release version; earlier green checks do not cover later changes automatically.
- [ ] Keep a known-good installer and clear manual update/recovery instructions. Verify an update preserves data; do not blindly roll back to an older version that cannot read newer data.

## 8. Optional Google Calendar: pass these or leave it out

- [ ] Verify the actual Google project setup and whether testers must be listed. If it is still in Testing, prepare the invite/reconnect instructions for that setup; do not require tester email collection for ordinary app use.
- [ ] Test sign-in, denied access, reconnect, token expiry and disconnect on a tester account. Calendar remains optional.
- [ ] Check upcoming meetings, time zones and duplicate notifications. Creating a calendar event requires the user's explicit confirmation of its details.
- [ ] Confirm Gmail is neither requested nor polled, and no page or guide promises email alerts.

## 9. What testers receive

- [ ] Choose one landing/download page for the invitation, while keeping all design alternatives in the project.
- [ ] Provide a working installer link, accurate supported-Mac details, version/date, known limitations, installation steps and uninstall/data-removal instructions.
- [ ] Provide one clear privacy page and a working feedback/support route. The current tester guide needs correction before it is sent.
- [ ] Remove email claims from every page or trailer that testers can reach, including comparison links. Original alternatives can stay private until cleaned up.
- [ ] If the old trailer is included, remove its email scene/narration, rebuild it, and update duration labels and preview clips. Otherwise omit it from the beta handoff.
- [ ] Ensure screenshots and descriptions match the actual meditation controls and shipped features. Check the chosen page on desktop and phone, with working download and feedback buttons.
- [ ] Use a short getting-started guide if the new onboarding flow remains deferred. A new tester can discover Tasks, Breathe, Settings, hiding the plant and returning to it.
- [ ] Explain how to report a bug with app version, Mac/macOS details and reproduction steps. Ask testers to remove private content from screenshots; do not collect conversations automatically.
- [ ] Gayathri approves hosting/uploading the installer and page, sharing invitations, any spending and any GitHub push. An unlisted link is not private access control; choose distribution accordingly.

## 10. Final go / no-go

- [ ] Gayathri tries the exact installed release and approves the appearance, voice, chat tone and core flows.
- [ ] One fresh tester can install and complete the basic journey without developer help: add a reminder, receive it, finish a breathing session, hide/restore the plant, and understand the sharing notice and send a chat if they choose.
- [ ] No unresolved launch blocker remains. Lesser issues are written down with a workaround and owner acceptance; broken optional features are excluded from the release and its promises.
- [ ] Record the version, test results, distribution location, known issues and emergency chat-off steps. Confirm who will respond to tester problems.
- [ ] Plan a short voluntary check-in after a few days: Were reminders reliable? Were nudges welcome? Was breathing useful? Was chat useful? What felt confusing or annoying? No tracking needs to be added for this.

## Not required for this private beta unless Gayathri changes scope

- Public launch, public marketing or a paid subscription system.
- Final branding, provided an agreed working name is used consistently.
- Building the deferred onboarding flow instead of using a clear tester guide.
- Spotify, Gemini/cloud voice, Gmail, AI-generated imagery or new hula-hoop/picnic animations.
- Finishing or publishing every landing-page alternative, or including a trailer.
- Removing the development testing tools. Remove/hide all testing aids before public launch; decide Showcase's beta visibility separately.
- Approved Zero Data Retention, provided the actual data handling is acceptable to Gayathri and explained honestly. Any promise of zero retention does require verified approval.

## Suggested order

1. Resolve privacy wording/context sharing and the outdated tester guide.
2. Test real OpenAI chat, approve tone, and put reliable spending controls in place.
3. Finish the chosen beta configuration and build a new installer.
4. Run the installer, reminder, meditation, desktop and privacy checks on a clean Mac.
5. Finish the selected page, feedback route and instructions; obtain Gayathri's release approval.
6. Invite the first small group and fix what they uncover before expanding.

Evidence reviewed: AGENTS.md, CLAUDE.md, relevant PRD requirements, current chat context and server code, packaging configuration, landing pages and tester guide. Older plans conflict on pricing, cloud voice and onboarding; the latest owner decisions take precedence. No deployment, paid test, installer rebuild or launch was performed while preparing this checklist.
