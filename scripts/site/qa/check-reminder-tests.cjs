// Real renderer, synthetic storage and chat, all external requests blocked.
// Run after vite build: npx electron scripts/site/qa/check-reminder-tests.cjs
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-privacy-ui-'));
app.setPath('userData',temp);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
const preload=path.join(temp,'preload.cjs');
fs.writeFileSync(preload,`
const {contextBridge,ipcRenderer}=require('electron');const noop=()=>{};const sub=()=>noop;
const info=()=>({clipLeft:0,clipRight:0,clipTop:0,clipBottom:0,winY:1000,workTop:0,workBottom:3000,plantTop:606});
contextBridge.exposeInMainWorld('companion',{
isPackaged:${process.env.TEST_PACKAGED === "1"},dataLoad:()=>ipcRenderer.invoke('test-load'),dataSave:d=>ipcRenderer.invoke('test-save',d),
dataReset:()=>ipcRenderer.invoke('test-reset'),chatSend:d=>ipcRenderer.invoke('test-chat',d),chatCancel:()=>ipcRenderer.invoke('test-cancel'),
onChatEvent:(name,fn)=>{const listener=(_e,d)=>fn(d);ipcRenderer.on(name,listener);return()=>ipcRenderer.removeListener(name,listener)},
layoutInfo:async()=>info(),setWindowSize:async s=>{await ipcRenderer.invoke('test-size',s);return info()},setClickThrough:noop,cursorClientPos:async()=>null,dragStart:noop,dragEnd:noop,
idleSeconds:async()=>0,setCallAutohide:noop,voiceCloudInfo:async()=>({available:false}),
brainStatus:async()=>({connected:true,viaProxy:true,provider:'openai'}),calendarStatus:async()=>({hasClient:true,connected:true,canCreateEvents:false}),getLoginItem:async()=>false,
voiceWarmup:async()=>{},voiceStatus:async()=>({ready:false}),voiceCancel:noop,ensureMic:()=>ipcRenderer.invoke('test-mic'),transcribe:b=>ipcRenderer.invoke('test-transcribe',b),onCalendarMeeting:fn=>{ipcRenderer.on('test-meeting',(_e,d)=>fn(d));return noop},onGmailNew:sub,onGoogleAuthExpired:sub,
});`);

let data={settings:{growthTestVisible:true,plantScale:.7,panelScale:1,welcomed:true,onboardingVersion:1,navigationTourVersion:1,soundsOn:false,voiceOn:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off',matchBackdrop:false},sprout:{date:new Date().toLocaleDateString('en-CA'),points:0},todos:[]};
let win;let transcriptions=0,micRequests=0;
ipcMain.handle('test-mic',()=>{micRequests++;return process.env.TEST_WELCOME!=='denied'});
ipcMain.handle('test-transcribe',()=>{transcriptions++;return 'a plant in disguise'});
if(process.env.TEST_WELCOME) { data.settings.welcomed=false; data.settings.onboardingVersion=0; }
if(process.env.TEST_STAGE) {data.sprout.points=(Number(process.env.TEST_STAGE)-1)*2;data.sprout.date=new Date(Date.now()-4*60*60*1000).toLocaleDateString('en-CA')}
if(process.env.TEST_DUE) data.todos=['Meditation break','Tea or coffee break','Meal break','Call a friend'].map((text,i)=>({id:'due-'+i,text,done:false,due:new Date(Date.now()-10_000).toISOString(),createdAt:new Date().toISOString(),firedAt:null}));
ipcMain.handle('test-load',()=>structuredClone(data));
ipcMain.handle('test-save',(_e,d)=>{data=structuredClone(d);return true});
ipcMain.handle('test-size',(_e,s)=>{win.setContentSize(s.width,s.height);return true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 win=new BrowserWindow({width:600,height:1000,show:false,webPreferences:{preload,offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 const js=c=>win.webContents.executeJavaScript(c);
 const out=path.resolve('docs/qa/2026-10-19/reminder-poses-joke-input',process.env.TEST_WELCOME||process.env.TEST_DUE&&'due'||process.env.TEST_STAGE||'default');fs.mkdirSync(out,{recursive:true});
 try {
  await win.loadFile(path.resolve('dist/index.html'));await wait(1000);
  const click=label=>js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing button '+${JSON.stringify(label)});b.click()})()`);
  if(process.env.TEST_WELCOME) {
   await wait(300);
   for(let n=0;n<7;n++) { await click('Next'); await wait(80); }
   assert.ok(await js(`document.body.textContent.includes('Enable microphone')`));
   assert.equal(micRequests,0,'permission must wait for a deliberate click');
   await wait(350);
   fs.writeFileSync(path.join(out,'welcome.png'),(await win.webContents.capturePage()).toPNG());
   if(process.env.TEST_WELCOME==='skip') await click('Continue with typing');
   else {
    await click('Enable microphone');await wait(100);assert.equal(micRequests,1);
    if(process.env.TEST_WELCOME==='denied') {
     assert.ok(await js(`document.body.textContent.includes('Microphone access is off')`));
     await click('Continue with typing');
    } else await click('Next');
   }
   await wait(80); await click("Let's begin");
   await wait(100);assert.equal(data.settings.welcomed,true);
   assert.equal(transcriptions,0,'permission never starts recording');
   await win.reload();await wait(1800);
   assert.equal(await js(`document.body.textContent.includes('Enable microphone')`),false,'welcome does not nag on relaunch');
   console.log('PASS first-run mic',process.env.TEST_WELCOME,'and remembered choice');app.exit(0);return;
  }
  if(process.env.TEST_DUE) {
   await wait(10_500); // Rest rotation must not replace an active meditation reminder.
   for(const [title,pose] of [['Meditation break','meditate1'],['Tea or coffee break','coffee1'],['Meal break','picnic'],['Call a friend','meeting1']]) {
    assert.ok(await js(`document.querySelector('[data-slot="bubble"]')?.textContent.includes(${JSON.stringify(title)})`));
    assert.ok(await js(`document.querySelector('[data-char-sprite]').getAttribute('src').includes('/${pose}/')`),title+' queue pose');
    await click('Snooze 10 min');await wait(150);
   }
   assert.ok(await js(`document.querySelector('[data-char-sprite]').getAttribute('src').includes('/growth1/')`),'dismissal ends persistent pose');
   console.log('PASS real scheduled queue: meditation, sipping, picnic, bell; snooze restores idle');app.exit(0);return;
  }
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(150);
  await click('settings');await wait(200);
  if(process.env.TEST_PACKAGED==='1') {
   assert.equal(await js(`document.body.textContent.includes('Test reminders & jokes')`),false,'test controls must stay out of installer');
   console.log('PASS reminder testing hidden in packaged app');app.exit(0);return;
  }
  await click('Test reminders & jokes');await wait(150);
  const baseline=structuredClone(data);
  fs.writeFileSync(path.join(out,'panel-light.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.documentElement.classList.add('dark')`);await wait(50);
  fs.writeFileSync(path.join(out,'panel-dark.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.documentElement.classList.remove('dark')`);
  const cases=[['Stretch','Did it','stretching'],['Walk or move','Not now','stretching'],['Drink water','Did it','watering'],['Bedtime','Good night','sleeping'],['Timed task','Done','meeting'],['Missed reminder','Snooze 10 min','meeting'],['Daily reminder','Done','meeting'],['Meditation break','Done','meditate'],['Meal break','Done','picnic'],['Tea or coffee break','Done','coffee'],['Meeting in 5 min','Got it','meeting'],['Meeting starting now','Got it','meeting'],['Tell a joke','What?','waving']];
  for(const [label,action,pose] of cases) {
   await click(label);await wait(120);
   assert.ok(await js(`document.querySelector('[data-slot="bubble"]')?.textContent.includes('Test preview')`),label+' must show preview');
   const src=await js(`document.querySelector('[data-char-sprite]').getAttribute('src')`);
   assert.ok(src.includes('/'+pose),label+' must play '+pose+': '+src);
   if(['Meditation break','Tea or coffee break'].includes(label)){const stage=Number(process.env.TEST_STAGE||1);const expected=pose+(stage===4?'':stage);assert.ok(src.includes('/'+expected+'/'),label+' must match growth stage '+stage)}
   if(label==='Missed reminder') assert.ok(await js(`document.body.textContent.includes('While you were away')`));
   if(label==='Meeting in 5 min') assert.ok(await js(`document.body.textContent.includes('"Sample meeting" in 5 min')`));
   if(['Meditation break','Meal break','Tea or coffee break'].includes(label)) fs.writeFileSync(path.join(out,label.replaceAll(' ','-')+'.png'),(await win.webContents.capturePage()).toPNG());
   if(label==='Timed task') fs.writeFileSync(path.join(out,'task-preview.png'),(await win.webContents.capturePage()).toPNG());
   await click(action);await wait(100);
   if(label==='Tell a joke') {
    assert.ok(await js(`document.querySelector('[data-char-sprite]').getAttribute('src').includes('/celebrating')`));
    fs.writeFileSync(path.join(out,'joke-punchline.png'),(await win.webContents.capturePage()).toPNG());
    await click('Haha');await wait(100);
   }
   assert.ok(await js(`document.body.textContent.includes('Test reminders & jokes')`),'returns to choices');
   assert.deepEqual(data,baseline,label+' must not change saved data');
   console.log('PASS',label,'pose, interaction, no saved changes');
  }
  // Typed and dictated answers stay editable and never enter saved chat history.
  await click('Tell a joke');await wait(100);
  await js(`(()=>{const e=document.querySelector('#joke-guess');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'A tiny tree');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);await wait(50);
  await click('Answer');await wait(100);
  assert.ok(await js(`document.body.textContent.includes('Your guess: A tiny tree')`));
  await click('Haha');await wait(100);assert.deepEqual(data,baseline);
  await click('Tell a joke');await wait(100);
  await js(`document.querySelector('[aria-label="hold to talk"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));void 0`);await wait(2200);
  await js(`document.querySelector('[aria-label="hold to talk"]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);
  for(let n=0;n<40;n++){await wait(100);if(await js(`document.querySelector('#joke-guess')?.value==='a plant in disguise'`))break}
  assert.ok(transcriptions>0,'voice reaches local transcription');
  assert.equal(await js(`document.querySelector('#joke-guess').value`),'a plant in disguise');
  assert.equal(await js(`document.body.textContent.includes('Your guess:')`),false,'dictation does not auto-submit');
  fs.writeFileSync(path.join(out,'dictated-guess.png'),(await win.webContents.capturePage()).toPNG());
  await click('Answer');await wait(100);assert.ok(await js(`document.body.textContent.includes('Your guess: a plant in disguise')`));
  await click('Haha');await wait(100);assert.deepEqual(data,baseline);
  console.log('PASS typed and microphone answers, review before submission, no saved answers');
  // A real Calendar alert must replace a preview, never be discarded by it.
  await click('Drink water');await wait(100);
  win.webContents.send('test-meeting',{title:'Real test meeting',minutesUntil:2});await wait(150);
  assert.ok(await js(`document.body.textContent.includes('Real test meeting')`));
  assert.equal(await js(`document.body.textContent.includes('Test preview')`),false);
  await click('Got it');await wait(100);
  assert.ok(await js(`document.body.textContent.includes('Test reminders & jokes')`));
  assert.deepEqual(data,baseline);
  console.log('PASS real alert takes priority and test panel returns');
  app.exit(0);
 } catch(e){console.error(e);app.exit(1)}
});
