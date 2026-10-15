// Build step (runs after `vite build`, before electron-builder): converts the
// character PNG frames in dist/ to WebP and points the bundle at them.
// Visually identical at quality 90 with lossless alpha, ~14% of the PNG size
// (472MB of art → ~70MB in the installer). Source PNGs in public/ are never
// touched, so dev mode and the clip pipeline keep working on PNG.
// Usage: node scripts/optimize-sprites.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIST = path.join(__dirname, "..", "dist");
const CHAR = path.join(DIST, "character");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".png")) out.push(p);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(CHAR)) throw new Error("dist/character missing; run vite build first");
  const files = walk(CHAR);
  let before = 0;
  let after = 0;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const out = f.replace(/\.png$/, ".webp");
      before += fs.statSync(f).size;
      await sharp(f).webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 4 }).toFile(out);
      after += fs.statSync(out).size;
      fs.unlinkSync(f);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  // Point the JS bundle at the .webp frames (only ./character/... paths).
  const assets = path.join(DIST, "assets");
  let rewritten = 0;
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const p = path.join(assets, name);
    const src = fs.readFileSync(p, "utf8");
    const out = src.replace(/(\.\/character\/[^"'`]+?)\.png/g, (_m, base) => {
      rewritten++;
      return `${base}.webp`;
    });
    if (out !== src) fs.writeFileSync(p, out);
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(`sprites: ${files.length} frames ${mb(before)}MB → ${mb(after)}MB webp; ${rewritten} paths rewritten`);
  if (files.length > 0 && rewritten === 0) throw new Error("no sprite paths rewritten in the bundle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
