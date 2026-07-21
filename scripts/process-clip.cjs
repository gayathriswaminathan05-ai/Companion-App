// Turn an AI-generated character video into game-ready animation frames.
// Usage: node scripts/process-clip.cjs <video.mp4> <stateName>
// Steps: extract frames (12fps, audio dropped) -> chroma-key + crop + scale
// (via Electron worker) -> public/character/<state>/ -> regenerate manifest.
const { execFileSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const ffmpeg = require("ffmpeg-static");

const [, , input, state] = process.argv;
if (!input || !state) {
  console.error("usage: node scripts/process-clip.cjs <video> <state>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clip-"));
const outDir = path.join(root, "public", "character", state);

const extractFps = parseInt(process.env.CLIP_FPS || "", 10) || 12;
console.log(`1/3 extracting frames (${extractFps}fps, no audio)…`);
execFileSync(ffmpeg, [
  "-i", input,
  "-vf", `fps=${extractFps},scale=-2:540`,
  "-an",
  path.join(tmp, "raw-%03d.png"),
], { stdio: "pipe" });
console.log("   " + fs.readdirSync(tmp).length + " raw frames");

console.log("2/3 removing background + cropping (Electron worker)…");
fs.rmSync(outDir, { recursive: true, force: true });
const res = spawnSync("npx", ["electron", path.join(__dirname, "clip-key.cjs")], {
  env: { ...process.env, CLIP_IN: tmp, CLIP_OUT: outDir, CLIP_STATE: state },
  encoding: "utf8",
});
const done = /FRAMES_WRITTEN:(\d+)/.exec(res.stdout + res.stderr);
if (!done) {
  console.error(res.stdout, res.stderr);
  process.exit(1);
}
console.log("   " + done[1] + " clean frames -> public/character/" + state);

console.log("3/3 regenerating sprite manifest…");
const charDir = path.join(root, "public", "character");
const states = fs.existsSync(charDir)
  ? fs.readdirSync(charDir).filter((d) => fs.statSync(path.join(charDir, d)).isDirectory())
  : [];
const manifest = {};
for (const s of states) {
  const frames = fs.readdirSync(path.join(charDir, s)).filter((f) => f.endsWith(".png")).sort();
  // One-shot story clips must NOT ping-pong or the action reverses.
  // Sleeping plays once then freezes under the blanket (holdLast).
  // growth = time-lapse scrubbed by stage (never ping-pong reverse).
  // Growth level-up transitions (grow1to2 … grow5to6): celebrate then grow,
  // play once and freeze on the newly-grown plant.
  const isGrowTransition = /^grow\dto\d$/.test(s);
  // Per-stage self-water / meeting-bell / stretch-walk: start=end still → play once.
  const isWateringStage = /^watering\d$/.test(s);
  const isMeetingStage = /^meeting\d$/.test(s);
  const isStretchingStage = /^stretching\d$/.test(s);
  // Per-stage idle loops are start≈end with baked blinks — forward loop only.
  // Ping-pong reverses through blinks and looks like weird eye twitching.
  const isGrowthStageIdle = /^growth\d$/.test(s);
  const oneshot = new Set(["celebrating", "sleeping", "laughing", "meeting", "growth", "draggedgrowth"]);
  const holdLast = new Set(["sleeping"]);
  if (isGrowTransition) { oneshot.add(s); holdLast.add(s); }
  if (isWateringStage || isMeetingStage) oneshot.add(s);
  // Stretch→walk: play once; freeze on last step so short clips can share a longer TIMED.
  if (isStretchingStage) { oneshot.add(s); holdLast.add(s); }
  const fast = new Set(["laughing"]);
  // Growth often extracted at CLIP_FPS=24 so blinks stay smooth.
  // Level-ups snappy (20fps); celebrating a touch under that so cork-pull reads.
  const growthFps = s === "growth" || s === "draggedgrowth" ? extractFps : 12;
  const fps = fast.has(s) ? 20 : isGrowTransition ? 20 : s === "celebrating" ? 16 : growthFps;
  manifest[s] = {
    frames: frames.map((f) => `./character/${s}/${f}`),
    fps,
    pingpong: !oneshot.has(s) && !isGrowthStageIdle,
  };
  if (holdLast.has(s)) manifest[s].holdLast = true;
  const metaFile = path.join(charDir, s, "meta.json");
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    if (meta.srcW) manifest[s].srcW = meta.srcW;
    if (meta.srcH) manifest[s].srcH = meta.srcH;
    if (meta.potScale) manifest[s].potScale = meta.potScale;
  }
}
// Grow transitions: potScale = DEST idle pot / clip END pot.
// Match the stage we land on so the last grow frame and the following idle
// are the same on-screen size (no size jump).
for (const s of Object.keys(manifest)) {
  const m = /^grow(\d)to(\d)$/.exec(s);
  if (!m) continue;
  const to = `growth${m[2]}`;
  const stageDir = path.join(charDir, to);
  const clipDir = path.join(charDir, s);
  if (!fs.existsSync(stageDir) || !fs.existsSync(clipDir)) continue;
  try {
    const { execFileSync } = require("child_process");
    const out = execFileSync("python3", ["-c", `
from PIL import Image
import numpy as np, glob, sys
def pot_w(path):
  arr=np.array(Image.open(path).convert("RGBA"))
  r,g,b,a=[arr[...,i].astype(np.int16) for i in range(4)]
  pot=(a>40)&(r>110)&(r>g+10)&(r>b+35)&(b<150)&(g>40)&(g<200)
  ys=np.where(pot.any(axis=1))[0]
  if len(ys)==0: return 0
  y0,y1=ys.min(),ys.max()
  best=0
  for y in range(int(y0+0.28*(y1-y0)), int(y0+0.55*(y1-y0))+1):
    xs=np.where(pot[y])[0]
    if len(xs)>=20: best=max(best, int(xs.max()-xs.min()+1))
  return best
stage=sorted(glob.glob(sys.argv[1]+"/f-*.png"))
clip=sorted(glob.glob(sys.argv[2]+"/f-*.png"))
sw=pot_w(stage[0])
cw=float(np.median([pot_w(p) for p in clip[-5:]]))
print(round(sw/cw, 4) if sw and cw else "")
`, stageDir, clipDir], { encoding: "utf8" }).trim();
    const potScale = parseFloat(out);
    if (potScale > 0.5 && potScale < 3) {
      manifest[s].potScale = potScale;
      const metaFile = path.join(clipDir, "meta.json");
      let meta = {};
      if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
      meta.potScale = potScale;
      fs.writeFileSync(metaFile, JSON.stringify(meta));
      console.log(`   potScale ${s} = ${potScale} (match ${to} idle)`);
    }
  } catch (e) {
    console.warn(`   potScale skip ${s}:`, e.message);
  }
}
const ts =
  "// AUTO-GENERATED by scripts/process-clip.cjs — do not edit by hand.\n" +
  "export interface SpriteAnim { frames: string[]; fps: number; pingpong: boolean; holdLast?: boolean; srcW?: number; srcH?: number; potScale?: number }\n" +
  "export const SPRITES: Record<string, SpriteAnim> = " +
  JSON.stringify(manifest, null, 2) +
  ";\n";
fs.mkdirSync(path.join(root, "src", "generated"), { recursive: true });
fs.writeFileSync(path.join(root, "src", "generated", "sprites.ts"), ts);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("done ✓ states with sprites: " + states.join(", "));
