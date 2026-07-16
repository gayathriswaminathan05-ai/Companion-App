// One-shot utility: renders the app icon (squircle tile + the ACTUAL AI
// character, taken from the idle sprite's first frame) to assets/icon.png.
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.dock && app.dock.hide();

app.whenReady().then(async () => {
  const charFrame = path.join(__dirname, "..", "public", "character", "idle", "f-001.png");
  if (!fs.existsSync(charFrame)) {
    console.error("no idle sprite frame found — generate sprites first");
    app.exit(1);
    return;
  }
  const charB64 = fs.readFileSync(charFrame).toString("base64");
  // Character fills the tile; the tile clips overflow inside its rounded
  // corners so the face stays big and legible at Dock size.
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;width:512px;height:512px;overflow:hidden}
    .tile{position:absolute;left:50px;top:50px;width:412px;height:412px;border-radius:92px;background:#FBEFE2;overflow:hidden}
    img{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);height:470px;image-rendering:auto}
  </style></head><body>
    <div class="tile"><img src="data:image/png;base64,${charB64}"></div>
  </body></html>`;

  const win = new BrowserWindow({
    show: false,
    width: 512,
    height: 512,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 700));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(path.join(__dirname, "..", "assets", "icon.png"), image.toPNG());
  console.log("icon.png written with the real character");
  app.quit();
});
