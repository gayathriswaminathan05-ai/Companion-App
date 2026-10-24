// Exercise the exact packaged source/preload/models with an empty temporary data
// folder. No personal data, real microphone, Google sign-in or network requests.
// Uses the same Electron version as the release; this is not clean-Mac sign-off.
const electron = require('electron');
const { app, BrowserWindow, session } = electron;
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const resources = path.resolve(process.argv[2] || 'release/0.1.1-beta.4/mac-arm64/Companion.app/Contents/Resources');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-packaged-beta-'));
app.setPath('appData', temp);
app.setPath('userData', path.join(temp, 'companion-app'));
fs.mkdirSync(app.getPath('userData'), { recursive: true });
Object.defineProperty(app, 'isPackaged', { value: true });
Object.defineProperty(process, 'resourcesPath', { value: resources });
let network = 0;
global.fetch = async () => { network++; throw new Error('External network blocked in release QA'); };
const originalWindow = BrowserWindow;
class QuietWindow extends originalWindow {
 constructor(opts) { super({ ...opts, show: false, webPreferences: { ...opts.webPreferences, offscreen: true, backgroundThrottling: false } }); this.webContents.setAudioMuted(true); }
 show() {} showInactive() {}
}
electron.BrowserWindow = QuietWindow;
// Do not touch this Mac's login preference, call permissions or real mic.
const dataFile = path.join(app.getPath('userData'), 'companion-data.json');
fs.writeFileSync(dataFile, JSON.stringify({settings:{welcomed:false,voiceOn:false,soundsOn:false,autoHideOnCalls:false,matchBackdrop:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off'},todos:[]}));
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = path.resolve('docs/qa/2026-10-24/release-0.1.1-beta.4');
fs.mkdirSync(out,{recursive:true});
app.whenReady().then(() => { app.dock?.hide(); session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>{network++;cb({cancel:true});}); });
require(path.join(resources,'app.asar','electron','main.cjs'));
app.whenReady().then(async () => {
 const until = async (fn, label, timeout=15000) => {const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await wait(100)}throw Error('Timed out: '+label)};
 let win;
 try {
  await until(()=>{win=originalWindow.getAllWindows()[0];return win&&!win.webContents.isLoading()},'window');
  const js = code => win.webContents.executeJavaScript(code);
  const press = async label => {await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);await wait(150)};
  const nav = async label => {await js(`document.querySelector('button[aria-label="${label}"]').click()`);await wait(200)};
  const menu = async () => {await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(250)};
  await until(()=>js(`document.querySelector('[data-onboarding-step="name"]')`),'first-open plant naming');
  for(let i=0;i<7;i++) await press('Next');
  await until(()=>js(`document.body.textContent.includes('Enable microphone')`),'optional microphone step');
  await press('Continue with typing');
  await press("Let's begin");
  await until(()=>js(`document.querySelector('[data-tour-step="tasks"]')`),'guided navigation');
  for (const step of ['tasks','voice','breathe','jokes','settings']) {
   assert.ok(await js(`document.querySelector('[data-tour-step="${step}"]')`));
   fs.writeFileSync(path.join(out,`packaged-tour-${step}.png`),(await win.webContents.capturePage()).toPNG());
   if(step !== 'settings') await press('Next');
  }
  await press('Make a reminder');
  await until(()=>js(`document.querySelector('[aria-label="add task"]')`),'tour opens real reminder entry');
  assert.equal(JSON.parse(fs.readFileSync(dataFile)).todos.length,0,'tour creates no sample task');
  assert.equal(JSON.parse(fs.readFileSync(dataFile)).settings.navigationTourVersion,1);

  assert.equal(JSON.parse(fs.readFileSync(dataFile)).settings.welcomed,true);
  assert.equal(await js(`!!document.querySelector('button[aria-label="chat"]')`),false);
  await nav('tasks');
  // Browser native input event through actual preload and persistence handlers.
  await js(`document.querySelector('input').focus()`);
  win.webContents.insertText('Beta storage check tomorrow at 6pm');
  await wait(250);await js(`document.querySelector('[aria-label="add task"]').click()`);await wait(300);
  let saved=JSON.parse(fs.readFileSync(dataFile));
  assert.equal(saved.todos.length,1);assert.ok(saved.todos[0].due);assert.equal(new Date(saved.todos[0].due).getHours(),18);
  const taskId=saved.todos[0].id;
  win.reload();await until(()=>!win.webContents.isLoading(),'reload');await wait(500);await menu();await nav('tasks');
  assert.ok(await js(`document.body.textContent.includes('Beta storage check')`));
  assert.equal(JSON.parse(fs.readFileSync(dataFile)).todos[0].id,taskId);
  await nav('settings');assert.equal(await js(`document.body.textContent.includes('Test reminders & jokes')`),false);
  assert.equal(await js(`document.body.textContent.includes('My brain key')`),false);
  // Actual local Kokoro utility process; inspect PCM, never play it.
  const speech=await js(`window.companion.voiceSynthesize({text:'Remember to call mom tomorrow at six.',voice:'af_heart'}).then(r=>({error:r.error,sampleRate:r.sampleRate,bytes:r.pcm?.byteLength}))`);
  assert.equal(speech.error,undefined);assert.equal(speech.sampleRate,24000);assert.ok(speech.bytes>24000);
  // Decode a bundled recording to 16 kHz and call the actual bundled Whisper.
  const transcription=await js(`(async()=>{const response=await fetch('./audio/meditation-guided-v2.m4a');const ac=new AudioContext({sampleRate:16000});const b=await ac.decodeAudioData(await response.arrayBuffer());const samples=b.getChannelData(0).slice(0,16000*8);await ac.close();return window.companion.transcribe(samples.buffer)})()`);
  assert.ok(typeof transcription==='string' && transcription.trim().length>4,JSON.stringify(transcription));
  await nav('breathe');await wait(250);
  const start=await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Start'))?.textContent.trim()`);assert.ok(start);await press(start);
  await until(()=>js(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pause')`),'meditation playback');await wait(1500);
  assert.ok(await js(`[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>0)`));
  fs.writeFileSync(path.join(out,'packaged-breathe.png'),(await win.webContents.capturePage()).toPNG());
  await press('Stop');
  assert.equal(network,0,'no external requests');
  const report={version:'0.1.1-beta.4',resources: path.relative(process.cwd(),resources),passed:['first-open naming and care setup with typing choice','all five guided tour steps and real reminder entry','native text insertion and timed task save','task persists across reload','chat/key/dev-test controls absent','real bundled Kokoro synthesis','real bundled Whisper transcription','meditation audio and clock','zero intercepted external requests'],transcription,limitations:['Same Mac and Electron runtime, isolated data; not another clean Mac or real microphone','Google sign-in and downloaded-app Gatekeeper not exercised'],network};
  fs.writeFileSync(path.join(out,'packaged-report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
  app.quit();
 } catch(e) {console.error(e);process.exitCode=1;app.quit();}
});
