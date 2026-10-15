# Design References (Mobbin) — UI pass v2, Oct 2026

What each reference taught us and where it landed in the app. Preview every
panel at once: run `npx vite`, open http://localhost:5173/gallery.html
(`src/dev/gallery.tsx` — dev only, never shipped).

## Chat window → `src/ui/ChatPanel.tsx`
| Reference | What we took |
|---|---|
| [Pi — home chat](https://mobbin.com/screens/16427281-f1f9-4255-862d-e6497b14ce84) | Assistant speaks as plain text (no bubble), user in a soft tinted bubble on the right; "today / yesterday" dividers |
| [Claude — chat](https://mobbin.com/screens/34fe8a95-5a3a-4ec3-83fa-82e68afcf57f) | One rounded composer card; calm neutral surface |
| [Beside — AI reply with sources](https://mobbin.com/screens/71796e40-c453-4f8d-958c-c4c4109ecd3b) | Bullets + small source pills under the answer |
| [Google Health — "Reading your message…"](https://mobbin.com/screens/f83bf2e7-c95a-4e28-8543-a3494dd4c0e0) | "thinking it over" pill with animated dots instead of "…" |
| [Microsoft Copilot — empty state](https://mobbin.com/screens/22fc091d-197d-43d5-a093-a9616321ef05), [Linktree AI](https://mobbin.com/screens/1410fe6a-87c5-41c9-8d0c-93204470891c) | Personal greeting + tap-to-send suggestion chips |
| [Tolan — character chat](https://mobbin.com/screens/45a63af0-3af9-4390-8d34-c7406811364a) | Character-first warmth; header shows the companion's name + "here with you" |

## Tasks → `src/ui/TaskPanel.tsx`
| Reference | What we took |
|---|---|
| [Amie — todo list](https://mobbin.com/screens/8651d9b8-539c-4a87-af9a-53a2f492dc3a) | Compact rows, time as a quiet coloured meta line, collapsible "done" |
| [Attio — my tasks](https://mobbin.com/screens/24d97071-f951-4c50-b21a-cabe794fe10e) | Section headers with counts ("scheduled 3", "anytime 2") |
| [Liven — to-do](https://mobbin.com/screens/830acd26-9c41-4a51-a754-0ce158b73563), [Tiimo — today](https://mobbin.com/screens/4054c64e-f464-4582-a3e1-c4612a62daf3) | "1/6" progress in the header; friendly round checks |
| [Todoist — inbox](https://mobbin.com/screens/efcd6f39-3b46-48cb-ae26-4558fbff5a4d) | Time/repeat meta under the title with small icons |

## Settings → `src/ui/SettingsPanel.tsx`
| Reference | What we took |
|---|---|
| [Wispr Flow — settings](https://mobbin.com/screens/4051a3c0-bc35-4b1d-8da6-13ebb3fa4781) | Grouped white cards, label + one-line description, control on the right |
| [Obsidian — editor settings](https://mobbin.com/screens/46a68598-bd04-4e49-b314-44dd8408f357) | Purple toggles, soft grey pill selects |
| [Insight Timer — notifications](https://mobbin.com/screens/02e7739a-484e-4199-8c86-e5e7837edd3a) | Caring, plain-language descriptions under each toggle |
| [Oura — memories](https://mobbin.com/screens/f5728230-f84a-40ac-aa8e-48b9238e1ae5), [Perplexity — memories](https://mobbin.com/screens/eb538ea7-fa47-4bc3-b534-bce460473e22) | Memory list with per-item delete; destructive "delete all" separated + explained |

## Reminder / nudge bubbles → `ReminderBubble.tsx`, `NudgeBubble.tsx`
| Reference | What we took |
|---|---|
| [Finch — speech bubble](https://mobbin.com/screens/076dbd90-543b-40b3-8c3b-950a76673efb), [Me+ — mascot bubble](https://mobbin.com/screens/59717fd3-8d48-4592-b977-8ae0f18cbe69) | Solid white speech bubble with a tail pointing at the character |
| [ClickUp — overdue reminder](https://mobbin.com/screens/0909b0bc-0c11-4acf-898b-1d3a82b0a669) | Small "when" eyebrow above a bold task title; primary done + secondary action |
| [YouTube — bedtime reminder](https://mobbin.com/screens/8212f3db-fa8b-45b1-892b-9e17adb8426d) | Gentle tone, snooze as an equal-weight option |

## Menu bar + quick nav → `RadialMenu.tsx`, `QuickNav.tsx`
| Reference | What we took |
|---|---|
| [ElevenLabs — floating toolbar](https://mobbin.com/screens/1ba23c74-f6cc-4a4c-9aa5-13b23a9dd129), [Fabric — quick add](https://mobbin.com/screens/c8e2800d-e105-4023-b8f2-35410ff90cb9) | Selected tool clearly different from hover; labels as small dark tooltips |

## System rules (v3, shadcn/ui)
- Foundation: shadcn/ui (radix base, Nova style) + Tailwind v4. Components live
  in `src/components/ui/` (owned code, edit freely); app composites (Panel,
  PanelHeader, SectionLabel, ListCard, SpeechBubble, GrowthIcon) in
  `src/components/panel.tsx`. Theme tokens in `src/index.css`.
- Colours are Gayathri's Figma palette, kept intact: #F3F3F3 panels with a
  white edge, white inputs, lavender #6A53E7 primary, #F5F3FF soft buttons,
  #E7E3FF / #190681 bubbles and chips, #201D2F ink. Not shadcn's grey defaults.
- Every floating surface has a hairline outer edge + deeper shadow so it stays
  visible over white apps.
- Light / dark follows macOS; opt-in "Match what's behind me" switches by the
  brightness of the app behind (src/usePanelTheme.ts).
- Type: Figtree Variable (self-hosted via @fontsource). Icons: Phosphor only.
- Shapes: panels 22px, cards 12px, controls 8-10px, floating bars round.
- Copy: no em-dashes, no emoji on buttons or labels (Blob's chat replies may
  still use them), sentence case in UI chrome.
- Past-due times are amber, never red. Destructive actions are two-step.
- Avoided AI tells: sparkle icons, gradient banners, glows, decorative status
  dots, hand-drawn icons, emoji on buttons.
