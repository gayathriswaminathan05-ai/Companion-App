const {app,BrowserWindow,session}=require('electron');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 const win=new BrowserWindow({width:1200,height:1000,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 const js=async c=>{try{return await win.webContents.executeJavaScript(c)}catch(e){console.error("Failed browser check:",c);throw e}};const out=path.resolve('docs/qa/2026-10-16');
 try{
 await win.loadFile('/tmp/companion-gallery-v3/gallery.html');await wait(400);
 await js(`window.frame=label=>[...document.querySelectorAll('figure')].find(f=>f.querySelector('figcaption')?.textContent===label);window.panel=()=>frame('Breathe: clean waves');window.press=(text,root=panel())=>[...root.querySelectorAll('button')].find(b=>b.textContent===text).click();void 0`);
 assert.equal(await js(`panel().textContent.includes('Set a reminder')`),false);
 for(const minutes of [1,3,5]) {
  await js(`press('${minutes} min')`);await wait(100);await js(`press('Start')`);
  // First launch may still be loading local media from disk. Wait for actual playback.
  for(let attempt=0;attempt<40;attempt++){
   if(await js(`(()=>{const [a,m]=panel().querySelectorAll('audio');return a.currentTime>.25&&!a.paused&&!m.paused})()`))break;
   await wait(250);
  }
  const state=await js(`(()=>{const [a,m]=panel().querySelectorAll('audio');return {duration:a.duration,time:a.currentTime,voice:!a.paused,music:!m.paused,waves:panel().querySelector('.meditation-waves').dataset.playing}})()`);
  assert.ok(Math.abs(state.duration-minutes*60)<.1&&state.time>0&&state.voice&&state.music, JSON.stringify(state));assert.equal(state.waves,'true');
  await js(`press('Pause')`);const at=await js(`panel().querySelector('audio').currentTime`);await wait(250);assert.equal(await js(`panel().querySelector('audio').currentTime`),at);
  await js(`press('Resume')`);await wait(100);await js(`panel().querySelector('audio').currentTime=${minutes*60-.4}`);await wait(900);
  assert.ok(await js(`panel().textContent.includes('Start again')`));
  console.log('PASS: duration, playback, pause/resume and ending',minutes,'minutes');
 }
 await js(`press('1 min')`);await wait(100);await js(`panel().querySelector('input[type=checkbox]').click()`);await wait(100);await js(`press('Start')`);await wait(350);
 assert.equal(await js(`panel().querySelector('.meditation-waves').dataset.playing`),'false','self-paced has no wave animation');
 await js(`press('Pause')`);await wait(100);
 await js(`panel().querySelector('input[type=checkbox]').click();press('3 min');panel().scrollIntoView({block:'center'})`);await wait(150);
 const shot=async name=>{const r=await js(`(()=>{const r=panel().getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()`);fs.writeFileSync(path.join(out,name),(await win.webContents.capturePage(r)).toPNG())};
 await shot('meditation-colour-light.png');
 await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Dark').click()`);await wait(150);await shot('meditation-colour-dark.png');
 await js(`press('Set reminder',frame('Settings (full length)'))`);await wait(100);
 assert.ok(await js(`frame('Settings (full length)').textContent.includes('Meditation reminder')`));
 await js(`const root=frame('Settings (full length)'),el=root.querySelector('input[type=datetime-local]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2099-01-01T10:00');el.dispatchEvent(new Event('input',{bubbles:true}));root.querySelector('input[type=checkbox]').click();void 0`);
 await js(`press('Set reminder',frame('Settings (full length)'))`);await wait(100);
 assert.ok(await js(`frame('Settings (full length)').textContent.includes('Daily meditation reminder saved')`));
 assert.ok(await js(`frame('Tasks').textContent.includes('Meditation break')`));
 const styles=await js(`(()=>{const s=frame('Settings (full length)').querySelector('[aria-label="movement style"]');return [...s.options].map(o=>o.value)})()`);assert.deepEqual(styles,['mixed','stretch','walk']);
 console.log('PASS: self-paced stops waves; reminders moved to Settings and saved as tasks; movement options; light/dark screenshots.');
 app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
