// Landing page QA (version A): logs the hero → say hi → story tour flow step by step.
// Needs http://localhost:8790. Run: OUT=/tmp/hero.txt npx electron scripts/site/qa/hero-flow.cjs

// Hidden-window run of the whole hero → tour flow. Writes progress as it goes.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const OUT = process.env.OUT;
const log = (...a) => fs.appendFileSync(OUT, a.join(" ") + "\n");
setTimeout(() => (log("TIMEOUT"), app.exit(1)), 150000);
app.whenReady().then(async () => {
  fs.writeFileSync(OUT, "");
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.on("console-message", (_e, level, msg) => level >= 2 && log("CONSOLE", msg));
  win.loadURL("http://localhost:8790/");
  await new Promise((r) => win.webContents.once("dom-ready", r));
  log("dom-ready");
  const js = (code) => Promise.race([win.webContents.executeJavaScript(code), new Promise((r) => setTimeout(() => r("js-timeout"), 3000))]);
  const t0 = Date.now();
  const snap = async (tag) => log(((Date.now() - t0) / 1000).toFixed(1) + "s", tag, await js(`JSON.stringify({ walker: document.getElementById('walker').className, sub: document.getElementById('bubbleSub').textContent.slice(-36), btn: document.getElementById('sayHi').className, sound: document.getElementById('soundToggle').getAttribute('aria-pressed') + ' ' + document.getElementById('soundToggle').className, y: Math.round(scrollY), narr: document.getElementById('narrator').className + ' | ' + document.getElementById('narratorText').textContent.slice(0, 40), tour: document.getElementById('tourBtn').hidden ? 'hidden' : document.getElementById('tourLabel').textContent, grow: document.getElementById('growLabel').textContent })`));
  for (const t of [1, 3.5, 6, 9, 12, 15]) {
    await new Promise((r) => setTimeout(r, t * 1000 - (Date.now() - t0)));
    await snap("hero");
  }
  await js(`document.getElementById('sayHi').click(); 1`);
  log("CLICKED say hi");
  for (let i = 0; i < 26; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    await snap("tour");
  }
  app.exit(0);
});
