# Wireframes (saved copy)

A copy of the claude.ai Design canvas "Beta Onboarding & Landing Wireframes"
(https://claude.ai/artifact/PTD5iYxQVt6jzmAi5DEPVz), saved here Oct 16, 2026
because that page lives in a company Claude account.

- `snapshots/` — a picture of every board. **Open these to look at the designs.**
- `boards/` — each board's source (`.dc.html`, the canvas's own format; opens
  roughly in a browser). `canvas.json` = the board layout and titles.
- `assets/` — the images and video the boards use.

Boards: landing v1, onboarding steps 1–9, in-app feedback button, trailer look
+ 9-shot storyboard, landing v2 (playful desk / busy work desk, intro sequence,
use-case chapters, phone), landing v3 (story, morning to night) and v3 on grid
paper (the chosen direction, built as `site/index.html`).

Owner rule: keep every design option side by side; never overwrite old ones.
Re-render the pictures after editing a board:
`npx electron scripts/site/qa/render-wireframes.cjs "$PWD/docs/wireframes"`
