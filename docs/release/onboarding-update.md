# Guided welcome update · beta.4

- Beta.4 correction prepared and tested on 24 October 2026: the tour also starts automatically after repeated or skipped care setup.
- Published as [beta 0.1.1-beta.4](https://github.com/gayathriswaminathan05-ai/Companion-App/releases/tag/v0.1.1-beta.4). The previous betas remain available.
- Gayathri approved publication on 24 October. Matching source is on ui-refresh-shadcn; main is unchanged.

## What people will see

1. Name their plant.
2. Choose water reminders, or leave them off.
3. Choose movement reminders and stretching, walking or both.
4. Choose a daily meditation reminder, or leave it off.
5. Choose a meal reminder, or leave it off.
6. Choose a coffee or tea reminder, or leave it off.
7. Choose bedtime, or leave it off.
8. Optionally enable the microphone; typing always remains available.
9. Review the routine and choose “Let's begin”.

- Back and Skip setup remain available. Fresh users who skip have no care reminders enabled.
- Closing the app during setup keeps the unfinished choices for next time.
- The speaker button reads the current explanation using the on-device voice.
- New daily reminders always start in the future. If today's time has passed, the first one is tomorrow.
- Settings → How I care for you → Set up my care routine opens the choices again.
- Daily meditation, meal and coffee reminders can also be edited or removed in Tasks.
- Existing personal tasks stay intact. Existing manual reminders are separate from reminders created through setup.

## First-launch correction

- Development and installed Companion intentionally share the same local data folder on the owner's Mac.
- This explains why installing a new copy can bring back an earlier meditation reminder. Personal reminders are not included in the installer.
- Reminders, wellness nudges, jokes, Calendar bubbles and idle rest poses wait until setup is complete. Call auto-hide is also paused during setup.
- Completion leaves a short quiet welcome period before existing overdue reminders can return.
- An overdue repeating task catches up once, then advances to its next future occurrence, instead of ringing for each missed day.

## Access and privacy

- Downloading and opening the app does not require a Google account or an invited email address.
- Local tasks, dictated reminders, wellness breaks, jokes and breathing work without Google.
- While the Google project is in Testing, only Google accounts on its test-user list can connect Calendar.
- Calendar alerts can include meetings with Google Meet links. This beta has read-only Calendar access; it does not create Google meetings.
- No new network service, cloud voice, AI chat or analytics was added.

## Release checks

- Gayathri reviewed the desktop update and approved release.
- Beta.4 installer, matching guide and privacy document are published; automated package checks and uploaded file checksum verification passed.
- Still needs tester confirmation on another Mac, including real microphone permissions and Google sign-in.
- Public download returned HTTP200. The previous beta is retained.

## Shorter, character-led option B (24 October)

- Replaced paragraphs with one short prompt and easy tap choices. Extra context lives under “Good to know”; local voice privacy remains visible on the microphone step.
- Existing plant clips accompany the choices: waving, watering, movement, meditation, picnic, coffee and bedtime. No generated assets or paid credits. Picnic uses the existing shared picnic clip; other selected clips have growth-stage variants.
- Pause/play controls and the Mac's reduced-motion preference control setup animation. Daily reminders still stay off until chosen; setup drafts, save validation, Back and Skip retain the same behavior.
- Original explanation-led option is preserved in `src/ui/OnboardingPanelV1.tsx`. The local UI gallery shows both options next to each other.
- Inspiration: [Mobbin's onboarding study](https://mobbin.com/blog/the-long-onboarding-a-study-of-1-460-flows) for clear progress, small personal choices and a useful finish; [Finch's pet creation](https://help.finchcare.com/hc/en-us/articles/37779580853005-Creating-Your-Birb) for introducing and naming the companion. These are design references, not evidence that this version will improve conversion.

## Guided navigation after setup

- After every completed or skipped care setup, including a later replay, people automatically see a five-step, skippable tour: Tasks and reminders, voice input, Breathe, jokes, and Settings/Nap.
- The real menu icons are shown in the tour. Selecting one finishes the tour and opens that feature. “Make a reminder” on the final screen opens Tasks; it does not create a reminder automatically.
- The reminder example is clearly marked. The sample joke can reveal its punchline without changing saved joke history or earning growth points. No microphone access, voice playback, breathing session or Google connection starts automatically.
- Unfinished tours resume at the last step. Completion and skipping are remembered. Settings → How I work → Show me around replays the tour without rerunning care setup.
- Automatic reminders stay quiet through the tour and for30seconds after it finishes. Existing tasks remain intact. Skipping care choices still opens the tour. The tour has its own Skip button.
- The original “A quick guide to me” stays collapsed until opened.
