// Isolated full-app regression: real geometry and hit testing, no owner data.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-hit-test-'));
app.setPath('userData', temp);
app.on('window-all-closed', () => {}); // keep the runner alive between sizes
const preload = path.join(temp, 'preload.cjs');
fs.writeFileSync(preload, `
const {contextBridge,ipcRenderer}=require('electron');
const noop=()=>{};
const subscribe=()=>noop;
const info=()=>({clipLeft:0,clipRight:0,clipTop:0,clipBottom:0,winY:1000,workTop:0,workBottom:3000,plantTop:606});
contextBridge.exposeInMainWorld('companion',{
 isPackaged:true, dataLoad:()=>ipcRenderer.invoke('test-data'),dataSave:noop,
 layoutInfo:async()=>info(),setWindowSize:async size=>{await ipcRenderer.invoke('test-size',size);return info()},
 setClickThrough:noop,cursorClientPos:async()=>null,dragStart:noop,dragEnd:noop,
 idleSeconds:async()=>0,setCallAutohide:noop,voiceCloudInfo:async()=>({enabled:false}),
 brainStatus:async()=>({connected:false}),calendarStatus:async()=>({connected:false}),
 voiceWarmup:async()=>{},voiceStatus:async()=>({ready:false}),
 onCalendarMeeting:subscribe,onGmailNew:subscribe,onGoogleAuthExpired:subscribe,onChatEvent:subscribe,
});`);
let scale=0.7, win;
ipcMain.handle('test-data',()=>({settings:{plantScale:scale,panelScale:1.45,welcomed:true,soundsOn:false,voiceOn:true,chatOn:false,breakMins:0,waterNudge:false,bedtime:null,jokeEvery:'off',matchBackdrop:false}}));
ipcMain.handle('test-size',(_e,s)=>win.setContentSize(s.width,s.height));
app.whenReady().then(async()=>{
 app.dock?.hide();
 session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 try {
  for(scale of [0.6,0.7,1,1.2]) {
   win=new BrowserWindow({width:479,height:1000,show:false,webPreferences:{preload,offscreen:true,backgroundThrottling:false}});
   win.webContents.setAudioMuted(true);
   const js=code=>win.webContents.executeJavaScript(code);
   await win.loadFile(path.resolve('dist/index.html'));
   await wait(700);
   // Open via the actual plant handlers, then navigate to Breathe.
   await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})); document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0})); void 0;`);
   await wait(150);
   await js(`document.querySelector('button[aria-label="breathe"]').click()`);
   await wait(150);
   const check=await js(`(() => {
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Start one minute');
    const r=b.getBoundingClientRect(), hit=document.querySelector('[data-char-hit]').getBoundingClientRect();
    const points=[[.5,.5],[.1,.1],[.9,.9]].map(([x,y])=>[r.x+r.width*x,r.y+r.height*y]);
    return {hitHeight:hit.height,points:points.map(([x,y])=>({x,y,button:document.elementFromPoint(x,y)?.closest('button')===b}))};
   })()`);
   assert.ok(Math.abs(check.hitHeight-240*scale)<1,`hit area follows plant size ${scale}`);
   assert.ok(check.points.every(p=>p.button),`Start receives actual pointer at scale ${scale}: ${JSON.stringify(check)}`);
   // Recreate the old stacking + unscaled hit layer as a negative control.
   if(scale===0.7) {
    const oldBlocked=await js(`(() => {
     const h=document.querySelector('[data-char-hit]'),scaled=h.parentElement,outer=scaled.parentElement;
     const panel=document.querySelector('[data-meditation]').closest('[data-slot="panel"]').parentElement.parentElement;
     panel.style.zIndex='auto'; outer.append(h);
     const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Start one minute'),r=b.getBoundingClientRect();
     const blocked=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===h;
     scaled.append(h);panel.style.zIndex='10';return blocked;
    })()`);
    assert.equal(oldBlocked,true,'negative control reproduces original invisible plant interception');
   }
   const point=check.points[0];
   win.webContents.sendInputEvent({type:'mouseDown',x:Math.round(point.x),y:Math.round(point.y),button:'left',clickCount:1});
   win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(point.x),y:Math.round(point.y),button:'left',clickCount:1});
   await wait(1300);
   const playback=await js(`(() => {const a=document.querySelector('[data-meditation="voice"]'),m=document.querySelector('[data-meditation="music"]');return {voice:!!a&&!a.paused,time:a?.currentTime,music:!!m&&!m.paused,pause:[...document.querySelectorAll('button')].some(b=>b.textContent==='Pause')}})()`);
   assert.ok(playback.voice&&playback.music&&playback.time>0&&playback.pause,JSON.stringify(playback));
   console.log('PASS: Start hit area and voice/music via pointer input at plant scale',scale);
   win.destroy();
  }
  app.exit(0);
 } catch(error) {console.error(error);app.exit(1);}
});
