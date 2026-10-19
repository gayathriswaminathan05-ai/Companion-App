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
isPackaged:false,dataLoad:()=>ipcRenderer.invoke('test-load'),dataSave:d=>ipcRenderer.invoke('test-save',d),
dataReset:()=>ipcRenderer.invoke('test-reset'),chatSend:d=>ipcRenderer.invoke('test-chat',d),chatCancel:()=>ipcRenderer.invoke('test-cancel'),
onChatEvent:(name,fn)=>{const listener=(_e,d)=>fn(d);ipcRenderer.on(name,listener);return()=>ipcRenderer.removeListener(name,listener)},
layoutInfo:async()=>info(),setWindowSize:async s=>{await ipcRenderer.invoke('test-size',s);return info()},setClickThrough:noop,cursorClientPos:async()=>null,dragStart:noop,dragEnd:noop,
idleSeconds:async()=>0,setCallAutohide:noop,voiceCloudInfo:async()=>({available:false}),
brainStatus:async()=>({connected:true,viaProxy:true,provider:'openai'}),calendarStatus:async()=>({hasClient:true,connected:true,canCreateEvents:false}),getLoginItem:async()=>false,
voiceWarmup:async()=>{},voiceStatus:async()=>({ready:false}),voiceCancel:noop,ensureMic:async()=>true,transcribe:b=>ipcRenderer.invoke('test-transcribe',b),onCalendarMeeting:fn=>{ipcRenderer.on('test-meeting',(_e,d)=>fn(d));return noop},onGmailNew:sub,onGoogleAuthExpired:sub,
});`);

let data={settings:{growthTestVisible:true,plantScale:.7,panelScale:1,welcomed:true,soundsOn:false,voiceOn:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off',matchBackdrop:false},sprout:{date:new Date().toLocaleDateString('en-CA'),points:0},todos:[]};
let win;
ipcMain.handle('test-load',()=>structuredClone(data));
ipcMain.handle('test-save',(_e,d)=>{data=structuredClone(d);return true});
ipcMain.handle('test-size',(_e,s)=>{win.setContentSize(s.width,s.height);return true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 win=new BrowserWindow({width:600,height:1000,show:false,webPreferences:{preload,offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 const js=c=>win.webContents.executeJavaScript(c);
 const out=path.resolve('docs/qa/2026-10-17/meditation-in-app');fs.mkdirSync(out,{recursive:true});
 try {
  await win.loadFile(path.resolve('dist/index.html'));await wait(1000);
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(150);
  await js(`document.querySelector('button[aria-label="breathe"]').click();void 0`);await wait(250);
  for (const stage of (process.env.MEDITATION_STAGES||'1,2,3,4,5,6,7').split(',').map(Number)) {
   await js(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(String(stage))}).click();void 0`);
   const expected=stage===4?'meditate':`meditate${stage}`;
   let src;
   for(let n=0;n<60;n++) {
    await wait(100);src=await js(`document.querySelector('[data-char-sprite]').getAttribute('src')`);
    if(src.includes('/'+expected+'/'))break;
   }
   assert.ok(src.includes('/'+expected+'/'),`stage ${stage}: ${src}`);
   await wait(300);
   const next=await js(`document.querySelector('[data-char-sprite]').getAttribute('src')`);
   assert.notEqual(src,next,'meditation frames must advance');
   const decoded=await js(`(()=>{const i=document.querySelector('[data-char-sprite]');return i.complete&&i.naturalWidth>0})()`);
   assert.ok(decoded,'sprite must decode');
   fs.writeFileSync(path.join(out,`stage-${stage}.png`),(await win.webContents.capturePage()).toPNG());
   console.log('PASS meditation stage',stage,expected,'decoded and animating');
  }
  app.exit(0);
 } catch(e){console.error(e);app.exit(1)}
});
