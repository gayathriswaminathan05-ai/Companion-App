// Erase content that pops in/out across sprite frames (e.g. a detached vine
// strand the AI video draws only in some frames). A pixel kept in the final
// frames must be present in at least KEEP fraction of all frames.
// Usage: node scripts/deflicker.cjs <framesDir> [keepFraction=0.85]
// NOTE: only for near-static clips (idle, sleeping). Big-motion clips have
// legitimately transient pixels — deflickering those would eat the motion.
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const DIR = path.resolve(process.argv[2] || process.env.DEFLICKER_DIR || "");
const KEEP = parseFloat(process.argv[3] || process.env.DEFLICKER_KEEP || "0.85");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false },
  });

  const js = `
    const fs = require("fs");
    const path = require("path");
    const DIR = ${JSON.stringify(DIR)};
    const KEEP = ${JSON.stringify(KEEP)};
    const files = fs.readdirSync(DIR).filter(f => f.endsWith(".png")).sort();

    function loadImage(p) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = "file://" + p;
      });
    }

    (async () => {
      const first = await loadImage(path.join(DIR, files[0]));
      const w = first.width, h = first.height;
      const count = new Uint16Array(w * h);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      for (const f of files) {
        const img = await loadImage(path.join(DIR, f));
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, w, h).data;
        for (let i = 0; i < w * h; i++) if (px[i*4 + 3] > 40) count[i]++;
      }
      const n = files.length;
      // Flicker mask: pixels present sometimes but not reliably. Small body
      // motion (breathing) creates THIN flicker fringes along every edge —
      // erasing those distorts the character. Content that genuinely pops
      // in/out (a detached vine strand) forms a THICK patch. Morphological
      // opening (erode then dilate) keeps only the thick patches.
      const flicker = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const frac = count[i] / n;
        if (frac > 0.03 && frac < KEEP) flicker[i] = 1;
      }
      const erodeDilate = (src, iterations, isErode) => {
        let cur = src;
        for (let it = 0; it < iterations; it++) {
          const next = new Uint8Array(w * h);
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = y * w + x;
              const hit = cur[i] + cur[i-1] + cur[i+1] + cur[i-w] + cur[i+w]
                        + cur[i-w-1] + cur[i-w+1] + cur[i+w-1] + cur[i+w+1];
              next[i] = isErode ? (hit === 9 ? 1 : 0) : (hit > 0 ? 1 : 0);
            }
          }
          cur = next;
        }
        return cur;
      };
      let mask = erodeDilate(flicker, 2, true);   // drop thin edge fringes
      mask = erodeDilate(mask, 5, false);         // regrow patches + AA halo
      // Only erase where the regrown patch is ALSO unstable — never touch
      // pixels that are present in (nearly) every frame.
      let erased = 0;
      for (const f of files) {
        const img = await loadImage(path.join(DIR, f));
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < w * h; i++) {
          if (d.data[i*4 + 3] > 0 && mask[i] && count[i] < n * 0.95) {
            d.data[i*4 + 3] = 0;
            erased++;
          }
        }
        ctx.putImageData(d, 0, 0);
        const b64 = c.toDataURL("image/png").split(",")[1];
        fs.writeFileSync(path.join(DIR, f), Buffer.from(b64, "base64"));
      }
      require("electron").ipcRenderer.send("df-done", erased);
    })().catch(e => require("electron").ipcRenderer.send("df-error", String(e && e.message || e)));
  `;

  ipcMain.on("df-done", (_e, n) => {
    console.log("DEFLICKER_ERASED_PX:" + n);
    app.exit(0);
  });
  ipcMain.on("df-error", (_e, msg) => {
    console.error("DEFLICKER_ERROR:" + msg);
    app.exit(1);
  });

  await win.loadURL("data:text/html,<html><body></body></html>");
  await win.webContents.executeJavaScript(js).catch((e) => {
    console.error("DEFLICKER_ERROR:" + e.message);
    app.exit(1);
  });
});
