// Render the trailer's screen mock-ups (HTML) to PNG at 2x with Electron.
// Usage: npx electron marketing/trailer/screens/capture.cjs [monitor.html]
// (one file per run: a second loadFile in the same run fails with ERR_FAILED)
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const JOBS = [
  ["monitor.html", 1600, 900],
  ["monitor-bare.html", 1600, 900],
  ["bubble.html", 400, 200],
  ["laptop.html", 1512, 982],
];
// Retina capture already doubles the pixels; CAPTURE_ZOOM=2 doubles again
// (pages scale their body with --z) for crisp trailer close-ups.
const Z = Number(process.env.CAPTURE_ZOOM || 1);

const only = process.argv.find((a) => a.endsWith(".html"));

app.whenReady().then(async () => {
  // any other page (e.g. bubble-*.html) captures at the bubble size
  const jobs = only ? [JOBS.find(([f]) => f === only) || [only, 400, 200]] : JOBS;
  for (const [file, w, h] of jobs) {
    const win = new BrowserWindow({
      show: false,
      width: w * Z,
      height: h * Z,
      useContentSize: true,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: { offscreen: true },
    });
    try {
      await win.loadFile(path.join(__dirname, file));
    } catch (e) {
      console.log("LOAD_FAILED", file, e.message);
      continue;
    }
    if (Z !== 1) await win.webContents.executeJavaScript(`document.body.style.setProperty('--z','${Z}')`);
    await new Promise((r) => setTimeout(r, 800));
    const img = await win.webContents.capturePage();
    const out = path.join(__dirname, file.replace(".html", Z !== 1 ? `@${Z * 2}x.png` : ".png"));
    fs.writeFileSync(out, img.toPNG());
    console.log("WROTE", out, img.getSize());
    win.destroy();
  }
  app.quit();
});
