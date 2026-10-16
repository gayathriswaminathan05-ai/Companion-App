// Usage: npx electron scripts/site/qa/render-wireframes.cjs "$PWD/docs/wireframes"

// Render each wireframe board (docs/wireframes/boards/*.dc.html) to a PNG at its canvas size.
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
const W = path.resolve(process.argv[process.argv.length - 1]);
const canvas = JSON.parse(fs.readFileSync(path.join(W, "canvas.json"), "utf8"));
setTimeout(() => app.exit(1), 240000);
app.on("window-all-closed", () => {}); // keep going between boards
app.whenReady().then(async () => {
  for (const name of canvas.order) {
    const b = canvas.boards[name];
    const h = Math.min(b.h, 5200);
    const win = new BrowserWindow({ width: b.w, height: h, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
    win.webContents.setZoomFactor(1);
    await win.loadFile(path.join(W, "boards", name)).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: b.w, height: h });
    fs.writeFileSync(path.join(W, "snapshots", name.replace(".dc.html", ".png")), img.toPNG());
    console.log("shot", name, b.w + "x" + h);
    win.destroy();
  }
  app.exit(0);
});
