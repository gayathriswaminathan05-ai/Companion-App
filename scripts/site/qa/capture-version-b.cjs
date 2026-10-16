// Landing page QA (version B): hidden Electron window captures screenshots and
// checks the trailer card/modal. Needs the site running: preview "beta-site"
// (http://localhost:8790). Run: OUT=/tmp/qa PAGE=b.html npx electron scripts/site/qa/capture-version-b.cjs

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const OUT = process.env.OUT;
const log = (...a) => fs.appendFileSync(`${OUT}/run.txt`, a.join(" ") + "\n");
setTimeout(() => (log("TIMEOUT"), app.exit(1)), 90000);
app.whenReady().then(async () => {
  fs.writeFileSync(`${OUT}/run.txt`, "");
  const win = new BrowserWindow({ width: Number(process.env.W || 1440), height: Number(process.env.H || 900), show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.on("console-message", (_e, level, msg) => level >= 3 && log("ERR", msg));
  win.loadURL("http://localhost:8790/" + (process.env.PAGE || ""));
  await new Promise((r) => win.webContents.once("did-finish-load", r));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (c) => Promise.race([win.webContents.executeJavaScript(c), wait(4000).then(() => "js-timeout")]);
  const shot = async (n) => fs.writeFileSync(`${OUT}/${n}.png`, (await win.webContents.capturePage()).toPNG());
  const go = (sel, block = "start") => js(`document.documentElement.style.scrollBehavior='auto'; document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'${block}'}); scrollBy(0, ${block === "start" ? -10 : 0}); 1`);
  await wait(3200);
  log("overflow:", await js("document.documentElement.scrollWidth + ' vs ' + innerWidth"));
  log("mini:", await js("document.getElementById('miniWrap').className + ' preview paused=' + document.querySelector('#miniTrailer video').paused"));
  await shot("b2-hero");
  await js("document.getElementById('miniTrailer').click(); 1");
  await wait(1800);
  log("modal:", await js("JSON.stringify({ open: !document.getElementById('trailerModal').hidden, playing: !document.getElementById('trailerVideo').paused, t: Math.round(document.getElementById('trailerVideo').currentTime*10)/10, muted: document.getElementById('trailerVideo').muted })"));
  await shot("b2-modal");
  await js("dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 1");
  await wait(500);
  log("after esc:", await js("JSON.stringify({ open: !document.getElementById('trailerModal').hidden, paused: document.getElementById('trailerVideo').paused })"));
  app.exit(0);
});
