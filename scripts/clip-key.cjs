// Electron worker: chroma-keys extracted frames, auto-crops to the character,
// scales to the app's 340x400 canvas (bottom-center anchored), writes PNGs.
// Args (env): CLIP_IN (raw frames dir), CLIP_OUT (final dir), CLIP_STATE.
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const IN = process.env.CLIP_IN;
const OUT = process.env.CLIP_OUT;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false },
  });

  const js = `
    const fs = require("fs");
    const path = require("path");
    const IN = ${JSON.stringify(IN)};
    const OUT = ${JSON.stringify(OUT)};
    const W = 340, H = 400;

    const files = fs.readdirSync(IN).filter(f => f.endsWith(".png")).sort();

    function loadImage(p) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = "file://" + p;
      });
    }

    // Flood-fill keying: transparency "pours in" from background seed points
    // and spreads through similar colors, stopping at the character's outline.
    // Handles gradient/two-tone backgrounds (e.g. white card on pink border)
    // without eating similar colors INSIDE the character (flower, highlights).
    function keyFrame(img, seeds) {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const w = c.width, h = c.height;
      const d = ctx.getImageData(0, 0, w, h);
      const px = d.data;
      const mask = new Uint8Array(w * h);
      const queue = [];
      const T = 42; // color tolerance vs the seed's color

      for (const [sx, sy] of seeds) {
        const x = Math.min(w - 1, Math.max(0, Math.round(sx)));
        const y = Math.min(h - 1, Math.max(0, Math.round(sy)));
        const idx = y * w + x;
        if (mask[idx]) continue;
        const si = idx * 4;
        const sr = px[si], sg = px[si+1], sb = px[si+2];
        mask[idx] = 1;
        queue.push(idx);
        while (queue.length) {
          const cur = queue.pop();
          const cx = cur % w, cy = (cur / w) | 0;
          for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1],[cx+1,cy+1],[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1]]) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (mask[ni]) continue;
            const pi = ni * 4;
            const dr = px[pi] - sr, dg = px[pi+1] - sg, db = px[pi+2] - sb;
            if (dr*dr + dg*dg + db*db < T*T) {
              mask[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }

      // Apply mask + 1px soft edge.
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) px[i*4 + 3] = 0;
      }
      // Second pass: enclosed background pockets (holes between vines) can't
      // be reached by the flood — clear anything clearly-background globally:
      // magenta-ish (border) and pure-white (card). The flower's petals carry
      // shading/tint so the strict white threshold leaves them alone.
      for (let i = 0; i < mask.length; i++) {
        const pi = i * 4;
        const r = px[pi], g = px[pi+1], b = px[pi+2];
        if (px[pi+3] === 0) continue;
        const magenta = r > 140 && b > 120 && g < r - 70 && g < b - 50;
        const cardWhite = r > 246 && g > 244 && b > 244 && Math.max(r,g,b) - Math.min(r,g,b) < 8;
        if (magenta || cardWhite) {
          px[pi+3] = 0;
          mask[i] = 1;
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (mask[i]) continue;
          if (mask[i-1] || mask[i+1] || mask[i-w] || mask[i+w]) {
            px[i*4 + 3] = Math.min(px[i*4 + 3], 140);
          }
        }
      }
      ctx.putImageData(d, 0, 0);
      return { canvas: c, data: d };
    }

    // Bounding box of the MAIN character: rows/columns need a meaningful
    // amount of opaque pixels, so tiny drifting petals don't inflate the crop.
    function bboxOf(data, w, h) {
      const px = data.data;
      const rows = new Uint32Array(h), cols = new Uint32Array(w);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (px[(y*w + x)*4 + 3] > 20) { rows[y]++; cols[x]++; }
        }
      }
      const MIN = 30;
      let minY = -1, maxY = -1, minX = -1, maxX = -1;
      for (let y = 0; y < h; y++) if (rows[y] >= MIN) { if (minY < 0) minY = y; maxY = y; }
      for (let x = 0; x < w; x++) if (cols[x] >= MIN) { if (minX < 0) minX = x; maxX = x; }
      return minY >= 0 && minX >= 0 ? { minX, minY, maxX, maxY } : null;
    }

    (async () => {
      // Background color: average the four corners of the first frame.
      const first = await loadImage(path.join(IN, files[0]));
      const c0 = document.createElement("canvas");
      c0.width = first.width; c0.height = first.height;
      const ctx0 = c0.getContext("2d");
      ctx0.drawImage(first, 0, 0);
      // Flood seeds: frame borders + upper background areas (the character
      // stands bottom-center, so the upper corners/center are always bg).
      const w0 = first.width, h0 = first.height;
      const bg = [];
      for (const y of [2, Math.round(h0*0.25), Math.round(h0*0.5), Math.round(h0*0.75), h0-3]) {
        bg.push([2, y], [w0-3, y]);
      }
      for (const x of [Math.round(w0*0.25), Math.round(w0*0.5), Math.round(w0*0.75)]) {
        bg.push([x, 2], [x, h0-3]);
      }
      bg.push(
        [Math.round(w0*0.5), Math.round(h0*0.06)],
        [Math.round(w0*0.15), Math.round(h0*0.1)],
        [Math.round(w0*0.85), Math.round(h0*0.1)],
      );

      // Pass A: per-frame bounding boxes (the source video may pan/zoom;
      // per-frame cropping keeps the character steady and LARGE).
      const boxes = [];
      for (const f of files) {
        const img = await loadImage(path.join(IN, f));
        const { data } = keyFrame(img, bg);
        boxes.push(bboxOf(data, img.width, img.height));
      }
      if (!boxes.some(Boolean)) throw new Error("no character found after keying");
      // Fill gaps, then temporally smooth each edge (moving average, ±4).
      let lastGood = boxes.find(Boolean);
      for (let i = 0; i < boxes.length; i++) {
        if (!boxes[i]) boxes[i] = { ...lastGood };
        else lastGood = boxes[i];
      }
      const smooth = boxes.map((_, i) => {
        const win = [];
        for (let j = Math.max(0, i - 4); j <= Math.min(boxes.length - 1, i + 4); j++) win.push(boxes[j]);
        const avg = (k) => win.reduce((s, b) => s + b[k], 0) / win.length;
        return { minX: avg("minX"), minY: avg("minY"), maxX: avg("maxX"), maxY: avg("maxY") };
      });

      // Pass B: crop each frame to its smoothed box, scale to fill 340x400
      // (bottom-center anchored), save.
      fs.mkdirSync(OUT, { recursive: true });
      let n = 0;
      for (let i = 0; i < files.length; i++) {
        const img = await loadImage(path.join(IN, files[i]));
        const { canvas } = keyFrame(img, bg);
        const b = smooth[i];
        const padX = (b.maxX - b.minX) * 0.03;
        const padY = (b.maxY - b.minY) * 0.03;
        const sx = Math.max(0, b.minX - padX);
        const sy = Math.max(0, b.minY - padY);
        const sw = Math.min(canvas.width, b.maxX + padX) - sx;
        const sh = Math.min(canvas.height, b.maxY + padY) - sy;
        const scale = Math.min(W / sw, H / sh);
        const dw = sw * scale, dh = sh * scale;
        const out = document.createElement("canvas");
        out.width = W; out.height = H;
        const octx = out.getContext("2d");
        octx.drawImage(canvas, sx, sy, sw, sh, (W - dw) / 2, H - dh, dw, dh);
        const b64 = out.toDataURL("image/png").split(",")[1];
        n++;
        fs.writeFileSync(path.join(OUT, "f-" + String(n).padStart(3, "0") + ".png"), Buffer.from(b64, "base64"));
      }
      require("electron").ipcRenderer.send("clip-done", n);
    })().catch(e => require("electron").ipcRenderer.send("clip-error", String(e && e.message || e)));
  `;

  const { ipcMain } = require("electron");
  ipcMain.on("clip-done", (_e, n) => {
    console.log("FRAMES_WRITTEN:" + n);
    app.exit(0);
  });
  ipcMain.on("clip-error", (_e, msg) => {
    console.error("CLIP_ERROR:" + msg);
    app.exit(1);
  });

  await win.loadURL("data:text/html,<html><body></body></html>");
  await win.webContents.executeJavaScript(js).catch((e) => {
    console.error("CLIP_ERROR:" + e.message);
    app.exit(1);
  });
});
