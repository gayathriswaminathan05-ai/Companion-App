// Real renderer, synthetic storage and chat, all external requests blocked.
// Run after vite build: npx electron scripts/site/qa/check-growth-handoff.cjs
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

let data={settings:{growthTestVisible:true,plantScale:.7,panelScale:1,welcomed:true,onboardingVersion:1,navigationTourVersion:1,soundsOn:false,voiceOn:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off',matchBackdrop:false},sprout:{date:new Date().toLocaleDateString('en-CA'),points:0},todos:[]};
let win;
ipcMain.handle('test-load',()=>structuredClone(data));
ipcMain.handle('test-save',(_e,d)=>{data=structuredClone(d);return true});
ipcMain.handle('test-size',(_e,s)=>{win.setContentSize(s.width,s.height);return true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 win=new BrowserWindow({width:600,height:1000,show:false,webPreferences:{preload,offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 const js=c=>win.webContents.executeJavaScript(c);
 const out=path.resolve('docs/qa/2026-10-19/grow6to7',process.env.QA_LABEL||'after');fs.mkdirSync(out,{recursive:true});
 try {
  await win.loadFile(path.resolve('dist/index.html'));await wait(1000);
  await js(`window.__frames=[];window.__start=performance.now();window.__watch=setInterval(()=>{const root=document.querySelector('[data-char-hit]')?.parentElement;window.__frames.push({t:performance.now()-window.__start,imgs:root?[...root.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),opacity:getComputedStyle(i).opacity})):[]})},16);[...document.querySelectorAll('button')].find(b=>b.title==='Play 6→7 celebration + leaf grow').click();void 0`);
  let elapsed=0;
  for(const time of [2700,3650,3850,4000,4150,4350,4650]) {
   await wait(time-elapsed);elapsed=time;
   fs.writeFileSync(path.join(out,`at-${time}.png`),(await win.webContents.capturePage()).toPNG());
  }
  const frames=await js(`clearInterval(window.__watch);window.__frames`);
  fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify(frames,null,2));
  const doubles=frames.filter(f=>f.imgs.length>1);
  console.log('Double-plant samples:',doubles.length);
  if(process.env.QA_LABEL!=='before') assert.equal(doubles.length,0,'handoff must never draw two plants together');
  assert.ok(frames.some(f=>f.imgs.some(i=>i.src.includes('/grow6to7/'))),'growth must play');
  assert.ok(frames.at(-1).imgs.some(i=>i.src.includes('/growth7/')),'must finish at stage7 idle');
  console.log('PASS 6→7 playback and settled stage7');
  app.exit(0);
 } catch(e){console.error(e);app.exit(1)}
});
