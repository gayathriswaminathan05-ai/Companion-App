# Google Calendar verification preparation

Prepared 19 October 2026. Status: NOT SUBMITTED. No claim of Google approval.

## Verified setup

- Google Cloud project: companion-app-502716.
- Registered client type: Desktop, verified in Google Cloud Console and matched locally against the bundled registration without publishing credentials in source.
- Public beta: https://github.com/gayathriswaminathan05-ai/Companion-App/releases/tag/v0.1.1-beta.2
- Current audience: External / Testing. One existing test user. Do not describe Calendar as open to everyone until production/review steps are completed.
- Saved Data Access declaration: https://www.googleapis.com/auth/calendar.events.readonly. Console confirmed “Data access changes saved!” No non-sensitive or restricted scopes declared.
- App name currently “Companion app”. Owner confirmation of public name/contact and owned domain is pending.
- Branding homepage, privacy link and authorized domains are currently empty. Existing Google support/developer contact is the owner's personal account. Do not substitute a guessed domain or publish contact details elsewhere without confirmation.

## Scope justification ready for the review form

Companion is a Mac desktop companion that provides local tasks, reminders, guided breathing and optional Google Calendar alerts. Users explicitly connect their Google account in Settings. The app reads upcoming timed events from their primary calendar to show the event title and a reminder before the start time, using the user's selected reminder lead time. Calendar is optional; the other app features work without it.

We request only calendar.events.readonly. Event titles and start times are needed for useful meeting alerts; free/busy information would not identify the event to the user. The beta does not create, edit or delete Google Calendar events, access Gmail, or require calendar-management permission. The scope's Google consent wording covers events on all calendars; this implementation calls only the primary calendar's events endpoint.

The app fetches a rolling three-hour window, up to twelve events ordered by start time, and polls every forty-five seconds while connected and alerts are enabled. All-day and cancelled events are skipped. Google returns event objects; the app uses their identifiers, titles and start times in memory. Fetched event details are not written into the local task database or uploaded to our servers. The app does not send Google user data to AI services. Calendar alerts are spoken on-device. No advertising, analytics or automatic diagnostic uploads are included.

Authorization opens the system browser and uses a local loopback callback, fresh state, and S256 PKCE. Access/refresh tokens are stored in files restricted to the Mac user account so background alerts can continue; they are not separately encrypted by the app. Disconnect stops polling and removes local tokens. Users can also revoke access in their Google Account. Local Delete all removes app data and connection credentials, but does not delete events in Google Calendar or Mac backups.

## Website/privacy preparation

Keep the existing landing-page design options. Do not deploy historical chat/email claims or the old trailer as this beta's homepage. The current beta privacy source is site/privacy.html; it accurately distinguishes local data from Google communication and describes deletion and permission behavior.

Before submitting:

- Confirm an owned domain and public app/support identity with the owner.
- Prepare a beta-accurate homepage on that domain describing the actual app, linking the live beta download and a public privacy page on the same domain.
- Include a public support/privacy contact confirmed by the owner.
- Include a clear Google user-data Limited Use commitment after reviewing the Google API Services User Data Policy against actual behavior. Never assert certification or verification before it exists.
- Verify domain ownership in Google Search Console with the Google project owner/editor account. Do not buy a domain or change DNS without required authorization.
- Enter the exact live URLs and authorized domain in Branding. Check accessibility without sign-in and on desktop/mobile. Complete branding verification/publication as the Console requires.

## Demonstration video plan

Record the real current beta, not a simulated OAuth response. Use a dedicated account with harmless sample events and obtain approval before granting sensitive Calendar access. Never record passwords, one-time codes, access/refresh tokens, other private appointments, or unrelated windows.

1. Show Companion version and Settings → Google Calendar.
2. Click Connect Google; show the real English Google consent flow, application name, address bar and client ID as required by Google. Pause recording for authentication or private account selectors.
3. Show that the requested permission is read-only Calendar events and finish consent with the account owner's approval.
4. Return to Companion and show Connected, Calendar reminders on, and the chosen lead time.
5. With a harmless “Companion demo meeting” inside the lead window, capture the actual title/time alert and on-device voice. Do not create or change the owner's real calendar without authorization.
6. Show Disconnect and verify the app stops Calendar alerts. Explain that Google events remain untouched and local app features still work.
7. Review the entire recording for private data and clarity before uploading an unlisted video to the owner's approved YouTube account. Record the actual video URL here only after upload.

Video status: not recorded or uploaded. Real fresh-account sign-in has not yet been independently verified for this release.

## Submission and follow-through

After the website, domain, branding and real demonstration are ready, use Google Auth Platform → Verification Center. Submit only the read-only events scope, this accurate justification, and the real demonstration link. Follow Google’s required order for branding publication, production audience and data-access verification. If Google presents legal acceptance or an action requiring owner confirmation, show the concrete request at that point.

Production audience alone is not verification. Before review approval an unverified warning/user cap can remain. Until the actual Console status changes, do not promise self-service Calendar connections or removal of warnings. After approval, test a previously unlisted account and update release notes/tester instructions to reflect verified behavior. Do not claim successful review or uninterrupted long-term access based only on the status switch.

## Official references

- https://support.google.com/cloud/answer/15549945?hl=en
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/identity/protocols/oauth2/native-app
