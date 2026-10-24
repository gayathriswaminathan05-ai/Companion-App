// Real renderer, synthetic storage and chat, all external requests blocked.
// Run after vite build: npx electron scripts/site/qa/check-privacy.cjs
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-privacy-ui-'));
app.setPath('userData',temp);
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
brainStatus:async()=>({connected:true,viaProxy:true,provider:'openai'}),calendarStatus:async()=>({connected:false}),getLoginItem:async()=>false,
voiceWarmup:async()=>{},voiceStatus:async()=>({ready:false}),voiceCancel:noop,onCalendarMeeting:sub,onGmailNew:sub,onGoogleAuthExpired:sub,
});`);
let data={settings:{chatOn:true,plantScale:.7,panelScale:1,welcomed:true,onboardingVersion:1,navigationTourVersion:1,soundsOn:false,voiceOn:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off',matchBackdrop:false},
todos:[{id:'private-task',text:'PRIVATE_TASK',done:false,createdAt:new Date().toISOString()}],chat:{messages:[],facts:['PRIVATE_NOTE'],summary:'PRIVATE_SUMMARY'}};
let win,requests=[],cancels=0,failSave=false;
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
  await win.loadFile(path.resolve('dist/index.html'));await wait(500);
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(150);
  await nav('chat');assert.equal(requests.length,0);
  assert.ok(await js(`document.body.textContent.includes('Before we chat')`));
  assert.equal(await js(`!!document.querySelector('textarea')`),false);
  await shot('chat-privacy-introduction.png');
  await press('Start chatting');assert.equal(data.settings.chatConsentVersion,1);assert.equal(requests.length,0,'accepting notice does not send a chat');
  await js(`(()=>{const t=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'unsent draft');t.dispatchEvent(new Event('input',{bubbles:true}))})()`);await wait(100);assert.equal(requests.length,0,'drafts stay local');
  await send();assert.equal(requests.length,1);assert.doesNotMatch(JSON.stringify(requests[0]),/PRIVATE_/);
  const oldId=requests[0].id;
  await nav('settings');assert.equal(await js(`!!document.querySelector('[aria-label="chat with AI"]')`),false,'no chat off switch');
  await press('Delete');assert.ok(cancels>0);assert.equal(data.chat.messages.length,0);assert.equal(data.chat.summary,'');assert.deepEqual(data.chat.facts,['PRIVATE_NOTE']);
  win.webContents.send('chat-chunk',{id:oldId,delta:'late reply'});win.webContents.send('chat-done',{id:oldId,text:'late reply <task>UNWANTED_TASK</task>'});await wait(150);
  assert.equal(data.chat.messages.length,0);assert.equal(data.todos.length,1,'late reply cannot create tasks');
  await win.reload();await wait(500);
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(100);
  await nav('chat');assert.equal(await js(`document.body.textContent.includes('Before we chat')`),false,'consent persists');assert.equal(data.chat.messages.length,0);
  await send();await nav('settings');failSave=true;await press('Delete');
  assert.ok(await js(`document.body.textContent.includes('Could not save the deletion')`));failSave=false;await press('Retry delete');assert.equal(data.chat.messages.length,0);
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Memories of you')).click()`);await wait(100);
  await js(`document.querySelector('[aria-label="forget this"]').click()`);await wait(100);assert.equal(data.chat.facts.length,0);
  await press('Delete all');await press('Forget everything');assert.ok(await js(`document.body.textContent.includes('Could not remove all local data')`));
  await press('No, wait');await js(`(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.textContent==='Chat privacy');el.scrollIntoView({block:'start'})})()`);await wait(100);await shot('settings-privacy.png');
  console.log('PASS: first-chat disclosure, no off switch, drafts local, minimal prompts, clear cancels late actions, deletion survives reload, note deletion, honest failure messages.');
  await win.loadFile(path.resolve('site/privacy.html'));win.setContentSize(1050,1000);await wait(100);fs.writeFileSync(path.join(out,'privacy-page-desktop.png'),(await win.webContents.capturePage()).toPNG());
  win.setContentSize(390,844);await wait(100);assert.equal(await js(`document.documentElement.scrollWidth<=innerWidth`),true);fs.writeFileSync(path.join(out,'privacy-page-phone.png'),(await win.webContents.capturePage()).toPNG());
  console.log('PASS: privacy page desktop and phone, no horizontal overflow.');app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
