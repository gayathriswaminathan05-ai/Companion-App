// Real renderer, synthetic storage and chat, all external requests blocked.
// Run after vite build: npx electron scripts/site/qa/check-onboarding.cjs
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

let data={settings:{welcomed:true,soundsOn:false,voiceOn:false,breakMins:30,waterNudge:true,waterMins:30,bedtime:'00:01',jokeEvery:'often',growthTestVisible:false},todos:[{id:'old-meditation',text:'Meditation break',done:false,recurring:'daily',due:new Date(Date.now()-5*86400000).toISOString(),createdAt:new Date().toISOString(),firedAt:null}]};
let win,micRequests=0,saveFailure=false;
ipcMain.handle('test-load',async()=>{await new Promise(r=>setTimeout(r,600));return structuredClone(data)});
ipcMain.handle('test-save',(_e,d)=>{if(saveFailure)return false;data=structuredClone(d);return true});
ipcMain.handle('test-size',(_e,s)=>{win.setContentSize(s.width,s.height);return true});
ipcMain.handle('test-mic',()=>{micRequests++;return false});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
 win=new BrowserWindow({width:600,height:1000,show:false,webPreferences:{preload,offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 const js=c=>win.webContents.executeJavaScript(c);
 const out=path.resolve('docs/qa/2026-10-24/onboarding-with-tour');fs.mkdirSync(out,{recursive:true});
 const step=()=>js(`document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep`);
 const waitForStep=async expected=>{for(let n=0;n<150;n++){if(await step()===expected)return;await wait(100)}assert.equal(await step(),expected,'renderer should finish loading setup')};
 const tourStep=()=>js(`document.querySelector('[data-tour-step]')?.dataset.tourStep`);
 const waitForTour=async expected=>{for(let n=0;n<150;n++){if(await tourStep()===expected)return;await wait(100)}assert.equal(await tourStep(),expected)};
 const click=async label=>{await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing '+${JSON.stringify(label)});b.click()})()`);await wait(100)};
 const change=async(label,value,select=false)=>{await js(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(${select?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('${select?'change':'input'}',{bubbles:true}))})()`);await wait(100)};
 const choose=async(group,label)=>{await js(`(()=>{const group=document.querySelector('[aria-label="${group}"]');const b=[...group.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)});if(!b)throw new Error('Missing choice');b.click()})()`);await wait(100)};
 const poses={name:'waving',water:'watering',movement:'stretching',meditation:'meditate',meal:'picnic',coffee:'coffee',bedtime:'sleeping',microphone:'waving',ready:'waving'};
 const shot=async label=>{
   await wait(600);const current=await step();
   assert.equal(await js(`document.querySelector('[data-setup-pose]')?.dataset.setupPose`),poses[current]);
   assert.ok(await js(`(()=>{const p=document.querySelector('[data-onboarding-step]');const main=p.querySelector('.setup-step');return main.scrollHeight<=main.clientHeight+1})()`),'choices should fit without scrolling: '+current);
   fs.writeFileSync(path.join(out,label+'.png'),(await win.webContents.capturePage()).toPNG());
 };
 try {
  await win.loadFile(path.resolve('dist/index.html'));await wait(1600);
  await js(`Object.defineProperty(document,'visibilityState',{get:()=> 'visible'});void 0`);
  assert.equal(await step(),'name','old hello is upgraded to care setup');
  const old=structuredClone(data.todos[0]);
  win.webContents.send('test-meeting',{title:'DO_NOT_INTERRUPT_SETUP',minutesUntil:1});
  await wait(9000);
  assert.equal(await js(`!!document.querySelector('[data-slot="bubble"]')`),false,'no old meditation or Calendar interruption');
  assert.deepEqual(data.todos[0],old,'blocked reminders are not marked as fired or advanced');
  assert.equal(micRequests,0);
  await click('Pause plant animation');await wait(200);
  const pausedFrame=await js(`document.querySelector('[data-setup-pose] img').src`);
  await wait(400);assert.equal(await js(`document.querySelector('[data-setup-pose] img').src`),pausedFrame);
  await click('Play plant animation');await wait(400);assert.notEqual(await js(`document.querySelector('[data-setup-pose] img').src`),pausedFrame);
  await click('About this step');assert.ok(await js(`document.querySelector('#setup-details').textContent.includes('stays on your Mac')`));await click('About this step');
  await shot('01-name-light');
  await js(`document.documentElement.classList.add('dark')`);await shot('01-name-dark');
  await js(`document.documentElement.classList.remove('dark')`);
  await change('Plant name','');assert.equal(await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Next').disabled`),true);
  await change('Plant name','Pepper');await click('Next');assert.equal(await step(),'water');
  await choose('Water reminder frequency','45 min');await shot('02-water');await click('Next');
  await choose('Movement reminder frequency','1 hr');await choose('Movement style','Walk');await shot('03-movement');await click('Next');
  await click('Daily reminder');await change('Daily reminder time','00:01');await shot('04-meditation');await click('Next');
  assert.equal(await step(),'meal');assert.equal(data.todos.length,1,'draft selections cannot add active tasks');
  await win.loadFile(path.resolve('dist/index.html'));await waitForStep('meal');assert.equal(await step(),'meal','resume without repeating setup');
  assert.equal(data.setup.name,'Pepper');assert.equal(data.setup.waterMins,45);
  await click('Previous setup step');assert.equal(await step(),'meditation');assert.equal(await js(`document.querySelector('[aria-label="Daily reminder time"]').value`),'00:01');await click('Next');
  await click('Daily reminder');await change('Daily reminder time','12:30');await shot('05-meal');await click('Next');
  await click('Daily reminder');await change('Daily reminder time','15:00');await shot('06-coffee');await click('Next');
  await shot('07-bedtime');await click('Next');assert.equal(await step(),'microphone');assert.equal(micRequests,0);
  await click('Enable microphone');assert.equal(micRequests,1);assert.ok(await js(`document.body.textContent.includes('Microphone access is off')`));
  await shot('08-microphone');await click('Continue with typing');assert.equal(await step(),'ready');
  await shot('09-ready-light');await js(`document.documentElement.classList.add('dark')`);await shot('09-ready-dark');await js(`document.documentElement.classList.remove('dark')`);
  saveFailure=true;await click("Let's begin");assert.equal(await step(),'ready');assert.ok(await js(`document.querySelector('[role="alert"]').textContent.includes("couldn't save")`));
  saveFailure=false;await click("Let's begin");assert.equal(await step(),undefined);assert.equal(data.settings.onboardingVersion,1);
  assert.equal(data.settings.companionName,'Pepper');assert.equal(data.settings.breakMins,60);assert.equal(data.settings.movementStyle,'walk');
  assert.deepEqual(data.todos.find(t=>t.id==='old-meditation'),old);
  assert.equal(data.todos.filter(t=>t.wellnessKind).length,3);
  for(const t of data.todos.filter(t=>t.wellnessKind))assert.ok(new Date(t.due).getTime()>Date.now());
  assert.equal(await tourStep(),'tasks','guided tour follows care setup');
  const beforeTour=structuredClone(data);
  for(const [i,current] of ['tasks','voice','breathe','jokes','settings'].entries()) {
   assert.equal(await tourStep(),current);
   if(current==='voice') {
    await win.loadFile(path.resolve('dist/index.html'));await waitForTour('voice');
    await click('Previous tour step');assert.equal(await tourStep(),'tasks');await click('Next');
   }
   if(current==='jokes') {await click('What?');assert.ok(await js(`document.querySelector('[data-tour-step]').textContent.includes('power plant!')`));}
   win.webContents.send('test-meeting',{title:'NO_TOUR_INTERRUPT',minutesUntil:1});
   await wait(500);
   assert.equal(await js(`!!document.querySelector('[data-slot="bubble"]')`),false);
   assert.ok(await js(`(()=>{const e=document.querySelector('[data-tour-step] .setup-step');return e.scrollHeight<=e.clientHeight+1})()`),'tour content fits: '+current);
   fs.writeFileSync(path.join(out,`tour-${i+1}-${current}.png`),(await win.webContents.capturePage()).toPNG());
   if(i<4)await click('Next');
  }
  assert.deepEqual(data.todos,beforeTour.todos,'examples never create or change tasks');
  assert.deepEqual(data.wellness,beforeTour.wellness,'tour never changes nudge history');
  assert.deepEqual(data.chat,beforeTour.chat,'sample joke does not change joke frequency/history');
  assert.deepEqual(data.sprout,beforeTour.sprout,'tour does not earn growth points');
  assert.equal(micRequests,1,'tour never requests a microphone permission');
  saveFailure=true;await click('Done');assert.equal(await tourStep(),'settings');assert.ok(await js(`document.querySelector('[role="alert"]').textContent.includes("couldn't save")`));
  saveFailure=false;await click('Make a reminder');assert.equal(await tourStep(),undefined);assert.equal(data.settings.navigationTourVersion,1);assert.ok(await js(`!!document.querySelector('[aria-label="add task"]')`),'final action opens real reminder creation');await click('close');
  console.log('PASS guided menu tour, resume/back, sample joke, no side effects or interruptions, failed-save retry.');
  await wait(2000);assert.equal(await js(`!!document.querySelector('[data-slot="bubble"]')`),false,'no immediate finish alert');
  console.log('PASS welcome priority, name and all care choices, resume/back, mic denied fallback, save failure/retry, no first-run alert.');
  await wait(30000);
  for(let n=0;n<50;n++){if(await js(`document.querySelector('[data-slot="bubble"]')?.textContent.includes('Meditation break')`))break;await wait(200)}
  assert.ok(await js(`document.querySelector('[data-slot="bubble"]')?.textContent.includes('Meditation break')`),'existing legitimate reminder resumes after setup grace period');
  assert.ok(new Date(data.todos.find(t=>t.id==='old-meditation').due)>new Date(),'daily reminder catches up once, not once for every missed day');
  await click('Done');await wait(8500);assert.equal(await js(`!!document.querySelector('[data-slot="bubble"]')`),false,'no repeated catch-up bubble');
  await win.loadFile(path.resolve('dist/index.html'));await wait(1700);assert.equal(await step(),undefined,'completed setup is remembered');
  assert.equal(await tourStep(),undefined,'finished tour stays finished on relaunch');
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(400);
  await click('settings');
  assert.equal(await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('A quick guide to me')).getAttribute('aria-expanded')`),'false','quick guide stays collapsed');
  await click('Show me around');assert.equal(await tourStep(),'tasks');
  await click('tasks');assert.equal(await tourStep(),undefined);assert.ok(await js(`!!document.querySelector('[aria-label="add task"]')`),'menu shortcut opens actual Tasks');
  await click('settings');await click('Show me around');await click('Skip tour');assert.equal(await tourStep(),undefined);assert.equal(data.settings.navigationTourVersion,1);
  // Repeating onboarding must open the tour even when it was completed earlier.
  await js(`document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));document.querySelector('[data-char-hit]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));void 0`);await wait(400);
  await click('settings');await click('Set up my care routine');await waitForStep('name');
  for(let i=0;i<7;i++)await click('Next');
  await click('Continue with typing');await click("Let's begin");
  assert.equal(await tourStep(),'tasks','repeated onboarding automatically starts the tour');
  await click('Skip tour');
  console.log('PASS repeated onboarding automatically opens tour; Settings replay, quick guide closed, real menu destination, skip.');
  // A truly fresh user can skip without silently enabling care nudges.
  data=null;await win.loadFile(path.resolve('dist/index.html'));await waitForStep('name');assert.equal(await step(),'name');
  await click('Skip setup');assert.equal(await step(),undefined);assert.equal(data.settings.breakMins,0);assert.equal(data.settings.bedtime,null);assert.equal(data.settings.waterNudge,false);assert.equal(data.todos.length,0);assert.equal(await tourStep(),'tasks','skipping care choices still introduces features');await click('Skip tour');assert.equal(await tourStep(),undefined);assert.equal(data.settings.navigationTourVersion,1);
  assert.equal(micRequests,1,'skip never requests another permission');
  console.log('PASS daily catch-up once, persistent completion, fresh-install skip leaves reminders off.');
  app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
