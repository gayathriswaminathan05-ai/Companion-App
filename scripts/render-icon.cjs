// One-shot utility: renders assets/icon.svg to a transparent 512px PNG.
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.dock && app.dock.hide();

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "..", "assets", "icon.svg"), "utf8");
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;width:512px;height:512px;overflow:hidden}
    svg{display:block}
  </style></head><body>${svg}</body></html>`;

  const win = new BrowserWindow({
    show: false,
    width: 512,
    height: 512,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 500));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(path.join(__dirname, "..", "assets", "icon.png"), image.toPNG());
  console.log("icon.png written with transparency");
  app.quit();
});
