// Real renderer, synthetic storage and chat, all external requests blocked.
// Run after vite build: npx electron scripts/site/qa/check-privacy.cjs
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
isPackaged:true,dataLoad:()=>ipcRenderer.invoke('test-load'),dataSave:d=>ipcRenderer.invoke('test-save',d),
dataReset:()=>ipcRenderer.invoke('test-reset'),chatSend:d=>ipcRenderer.invoke('test-chat',d),chatCancel:()=>ipcRenderer.invoke('test-cancel'),
onChatEvent:(name,fn)=>{const listener=(_e,d)=>fn(d);ipcRenderer.on(name,listener);return()=>ipcRenderer.removeListener(name,listener)},
layoutInfo:async()=>info(),setWindowSize:async s=>{await ipcRenderer.invoke('test-size',s);return info()},setClickThrough:noop,cursorClientPos:async()=>null,dragStart:noop,dragEnd:noop,
idleSeconds:async()=>0,setCallAutohide:noop,voiceCloudInfo:async()=>({available:false}),
brainStatus:async()=>({connected:true,viaProxy:true,provider:'openai'}),calendarStatus:async()=>({hasClient:true,connected:true,canCreateEvents:false}),getLoginItem:async()=>false,
voiceWarmup:async()=>{},voiceStatus:async()=>({ready:false}),voiceCancel:noop,ensureMic:async()=>true,transcribe:b=>ipcRenderer.invoke('test-transcribe',b),onCalendarMeeting:fn=>{ipcRenderer.on('test-meeting',(_e,d)=>fn(d));return noop},onGmailNew:sub,onGoogleAuthExpired:sub,
});`);
let data={settings:{chatOn:true,plantScale:.7,panelScale:1,welcomed:true,onboardingVersion:1,navigationTourVersion:1,soundsOn:false,voiceOn:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off',matchBackdrop:false},
todos:[{id:'private-task',text:'PRIVATE_TASK',done:false,createdAt:new Date().toISOString()}],chat:{messages:[],facts:['PRIVATE_NOTE'],summary:'PRIVATE_SUMMARY'}};
let win,requests=[],cancels=0,failSave=false,transcriptions=0;
ipcMain.handle("test-transcribe",(_e,b)=>{assert.ok(b.byteLength>0);transcriptions++;return "call mom tomorrow at 6 pm"});
ipcMain.handle('test-load',()=>structuredClone(data));
ipcMain.handle('test-save',(_e,d)=>{if(failSave)return false;data=structuredClone(d);return true});
ipcMain.handle('test-size',(_e,s)=>win.setContentSize(s.width,s.height));
ipcMain.handle('test-chat',(_e,d)=>{requests.push(d);return {ok:true}});
ipcMain.handle('test-cancel',()=>{cancels++;return true});
ipcMain.handle('test-reset',()=>({ok:false})); // Never touches real owner data.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 win=new BrowserWindow({width:600,height:1000,show:false,webPreferences:{preload,offscreen:true,backgroundThrottling:false}});
 const js=async c=>{try{return await win.webContents.executeJavaScript(c)}catch(e){console.error("Failed UI check:",c);throw e}};
 const out=path.resolve('docs/qa/2026-10-17');fs.mkdirSync(out,{recursive:true});
 const press=async label=>{await js(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);await wait(100)};
 const nav=async name=>{await js(`document.querySelector('button[aria-label="${name}"]').click()`);await wait(100)};
 const shot=async name=>{const r=await js(`(()=>{const r=document.querySelector('[data-slot="panel"]').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()`);fs.writeFileSync(path.join(out,name),(await win.webContents.capturePage(r)).toPNG())};
 const send=async()=>{await js(`(()=>{const t=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'hello friend');t.dispatchEvent(new Event('input',{bubbles:true}))})()`);await wait(50);await js(`document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}))`);await wait(150)};
 try{
  await win.loadFile(path.resolve('dist/index.html'));await wait(600);
  // Offscreen checks need visible-document semantics for the Calendar alert guard.
  await js(`Object.defineProperty(document,'visibilityState',{get:()=> 'visible'});void 0`);
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(200);
  assert.equal(await js(`!!document.querySelector('button[aria-label="chat"]')`),false);
  assert.equal(await js(`!!document.querySelector('button[aria-label="showcase"]')`),true,'keep beta showcase');
  await nav('tasks');
  assert.equal(await js(`!!document.querySelector('[aria-label="hold to talk"]')`),true);
  await shot('beta-without-chat-tasks.png');
  // Exercise recording -> local transcription result -> editable draft -> reminder.
  await js(`document.querySelector('[aria-label="hold to talk"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));void 0`);
  // Device startup is asynchronous; hold for a real recording interval.
  for(let i=0;i<100;i++){if(await js(`document.querySelector('[aria-label="hold to talk"]').getAttribute('aria-pressed')==='true'`))break;await wait(100)}
  assert.equal(await js(`document.querySelector('[aria-label="hold to talk"]').getAttribute('aria-pressed')`),'true','fake microphone must start: '+await js(`document.querySelector('[role="alert"]')?.textContent || ''`));
  await wait(2200);
  await js(`document.querySelector('[aria-label="hold to talk"]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);
  for(let i=0;i<40 && !transcriptions;i++)await wait(150);
  assert.ok(transcriptions>0,'microphone route reaches local transcription bridge');await wait(300);
  assert.equal(await js(`document.querySelector('input').value`),'call mom tomorrow at 6 pm');
  assert.equal(data.todos.length,1,'dictation does not auto-save');
  await nav('tasks'); // current panel, preserves draft
  await js(`document.querySelector('[aria-label="add task"]').click()`);await wait(200);
  const task=data.todos.find(t=>t.text==='call mom');assert.ok(task?.due,'dictated reminder saved with time');
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  assert.equal(new Date(task.due).toDateString(),tomorrow.toDateString());assert.equal(new Date(task.due).getHours(),18);
  await shot('beta-without-chat-voice-reminder.png');
  await nav('settings');
  assert.equal(await js(`!!document.querySelector('[aria-label="read chat replies aloud"]')`),false);
  assert.equal(await js(`document.body.textContent.includes('My brain key')`),false);
  assert.equal(await js(`document.body.textContent.includes('Chat with me')`),false);
  assert.ok(await js(`document.body.textContent.includes('Google Calendar') && document.body.textContent.includes('Connected')`));
  assert.equal(await js(`document.body.textContent.includes('Reconnect to let me book meetings')`),false,'read-only calendar is sufficient');
  assert.ok(await js(`!!document.querySelector('[aria-label="meeting reminders"]')`));
  await js(`(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.textContent==='Google Calendar');e.scrollIntoView({block:'start'})})()`);await wait(100);await shot('beta-without-chat-calendar.png');
  await js(`(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.textContent==='On your Mac');e.scrollIntoView({block:'start'})})()`);await wait(100);await shot('beta-without-chat-privacy.png');
  // Old private data is retained and can be removed deliberately.
  await press('Delete');assert.equal(data.chat.messages.length,0);assert.equal(data.chat.summary,'');
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Memories of you')).click()`);await wait(100);
  await js(`document.querySelector('[aria-label="forget this"]').click()`);await wait(150);assert.equal(data.chat.facts.length,0);
  await nav('breathe');assert.ok(await js(`document.body.textContent.includes('Start')`));
  win.webContents.send('test-meeting',{title:'TEST_CALENDAR_ALERT',minutesUntil:5});await wait(200);
  assert.ok(await js(`document.body.textContent.includes('TEST_CALENDAR_ALERT')`),'Calendar alert still appears');
  assert.ok(!JSON.stringify(data).includes('TEST_CALENDAR_ALERT'),'calendar content never saved');
  assert.equal(requests.length,0,'no chat requests during beta flows');
  console.log('PASS: no Chat/key controls; Showcase kept; microphone capture with synthetic transcription creates a reviewed timed reminder; Calendar controls and alert survive; legacy data deletion works; no AI calls.');
  app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
