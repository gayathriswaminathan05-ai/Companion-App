// Local integration checks and screenshots. No AI requests or personal data.
// npx electron scripts/site/qa/check-v2.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(process.env.OUT || 'docs/qa/2026-10-16');
fs.mkdirSync(out, { recursive: true });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const errors = [];
  const report = [];
  try {
    for (const page of ['a2', 'b2']) {
      for (const width of [1440, 390, 320]) {
        const win = new BrowserWindow({ width, height: 900, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(`${page}/${width}: ${message}`); });
        const js = code => win.webContents.executeJavaScript(code);
        await win.loadFile(path.resolve(`site/${page}.html`));
        await wait(800);
        assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, `${page} overflow ${width}`);
        assert.equal(await js("/email|gmail/i.test(document.body.innerText)"), false, `${page} still advertises email`);
        assert.equal(await js("document.querySelectorAll('.version-nav a').length"), 4);
        const shot = async name => fs.writeFileSync(path.join(out, `${page}-${width}-${name}.png`), (await win.webContents.capturePage()).toPNG());
        if (width !== 320) await shot('hero');
        for (const selector of ['#grow', '.v2-chat-demo', '#breathe', '#privacy']) {
          await js(`document.documentElement.style.scrollBehavior='auto';document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});`);
          await wait(500);
          if (width !== 320) await shot(selector.replace(/[#.]/g, ''));
        }
        await js("document.querySelector('.grow-buttons button').click()");
        assert.equal(await js("document.querySelector('#growMeter').getAttribute('aria-valuenow')"), '2');
        await js("document.querySelector('#growReset').click()");
        assert.equal(await js("document.querySelector('#growMeter').getAttribute('aria-valuenow')"), '0');
        await js("document.querySelector('[data-chat-example=banter]').click()");
        assert.match(await js("document.querySelector('.v2-example').textContent"), /another leaf/);
        await js("document.querySelector('#jokeWhat').click()");
        assert.equal(await js("document.querySelector('#jokeNext').hidden"), false);
        assert.equal(await js("document.querySelector('#downloadBtn').getAttribute('aria-disabled')"), 'true');
        if (page === 'a2') {
          assert.equal(await js('STEPS.length === TOUR_TEXT.length && TOUR_TEXT.length === TOUR_STAGE.length && TOUR_STAGE.length === TOUR_AUDIO.length'), true);
          await js("document.querySelector('#sayHi').click()");
          await wait(1600);
          assert.equal(await js('touring'), true);
          await js("dispatchEvent(new WheelEvent('wheel'))");
          assert.equal(await js('touring'), false);
        }
        report.push(`${page} ${width}px: layout, growth/reset, chat examples, joke, links${page === 'a2' ? ', tour start/pause and audio mapping' : ''} passed`);
        win.destroy();
      }
    }
    assert.deepEqual(errors, [], 'browser errors');
    fs.writeFileSync(path.join(out, 'landing-checks.txt'), report.join('\n') + '\n');
    console.log(report.join('\n'));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
