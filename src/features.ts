import releaseFeatures from "../electron/features.json";

/**
 * Features we ship (owner decisions). Flip a flag to bring something back.
 *
 * gmailAlerts — new-email bubbles. OFF for now (Oct 16): Gmail access is a
 * Google "restricted" scope, and going public with it needs a paid yearly
 * security assessment. Off means: no Gmail toggle in Settings, no Gmail scope
 * in Google sign-in (electron/calendar.cjs GMAIL_FEATURE), no mail bubbles.
 */
export const FEATURES = {
  // Shared with Electron: this beta has no AI chat, even with an old saved key.
  aiChat: releaseFeatures.aiChat,
  gmailAlerts: false,
} as const;
