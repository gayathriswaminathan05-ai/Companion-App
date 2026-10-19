// Offline privacy regressions. Only synthetic data and SDK doubles are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-privacy-'));
for (const entry of ['brain', 'store']) await build({ input:`src/${entry}.ts`,platform:'node',logLevel:'silent',output:{file:path.join(temp,`${entry}.mjs`),format:'esm'} });
const brain = await import(pathToFileURL(path.join(temp,'brain.mjs')));
const store = await import(pathToFileURL(path.join(temp,'store.mjs')));
const d=store.emptyData();
d.settings.userName='PRIVATE_PROFILE';d.settings.companionName='PRIVATE_PET_NAME';
d.todos=[{text:'PRIVATE_TASK',done:false},{text:'PRIVATE_COMPLETED',done:true,completedAt:new Date().toISOString()}];
d.chat.facts=['PRIVATE_MEMORY'];d.chat.summary='PRIVATE_SUMMARY';d.calendarEvents=[{title:'PRIVATE_CALENDAR'}];
d.chat.messages=Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',text:`conversation ${i}`}));
const system=JSON.stringify(brain.buildSystem(d,{canBookMeetings:true}));
assert.doesNotMatch(system,/PRIVATE_/);
assert.equal(brain.buildMessages(d).length,16);assert.equal(brain.buildMessages(d)[0].content,'conversation 4');
assert.equal(store.defaultSettings().chatConsentVersion,0);
globalThis.window={companion:{dataLoad:async()=>structuredClone({...d,settings:{...d.settings,chatOn:true,chatConsentVersion:undefined}}),dataSave:()=>{}}};
assert.equal((await store.loadData()).settings.chatConsentVersion,0,'old defaults require explicit consent');
window.companion.dataLoad=async()=>structuredClone({...d,settings:{...d.settings,chatConsentVersion:1}});
assert.equal((await store.loadData()).settings.chatConsentVersion,1);
console.log('PASS: only recent conversation enters chat; private tasks/profile/memories/summary/calendar excluded; consent migration.');

// Run the actual main-process IPC handlers, replacing OS/storage/SDK boundaries.
const files=new Map(),handlers=new Map(),events=[];let pending=[],writesFail=false,deleteFail=false,loads=0,calendarCleared=0,login;
const root=path.join(temp,'companion-app'), dataPath=path.join(root,'companion-data.json');
const fakeFs={
 chmodSync:()=>{},
 readFileSync:p=>{if(!files.has(p))throw Object.assign(new Error('missing'),{code:'ENOENT'});return files.get(p)},
 writeFileSync:(p,v)=>{if(writesFail)throw new Error('disk unavailable');files.set(p,String(v))},
 unlinkSync:p=>{if(deleteFail&&p===dataPath)throw Object.assign(new Error('denied'),{code:'EACCES'});if(!files.delete(p))throw Object.assign(new Error('missing'),{code:'ENOENT'})},
 existsSync:p=>files.has(p),
};
function stream(body,options,provider){loads++;let resolve;const promise=new Promise(r=>{resolve=r});const listeners={};pending.push({body,signal:options.signal,listeners,resolve,provider});return {on:(k,fn)=>{listeners[k]=fn},finalResponse:()=>promise,finalMessage:()=>promise};}
let clientOptions;
class SDK {constructor(options){clientOptions=options;this.responses={stream:(b,o)=>stream(b,o,'openai')};}}
const calendar={clearTokens:()=>{calendarCleared++},clearClient:()=>{},stopPolling:()=>{}};
const app={setPath:()=>{},getPath:()=>temp,whenReady:()=>({then:()=>{}}),on:()=>{},getSystemLocale:()=> 'en-IN',setLoginItemSettings:v=>login=v};
// main calls getPath(userData), so mirror the path it sets, without real filesystem access.
app.getPath=kind=>kind==='userData'?root:temp;
files.set(path.resolve('electron/beta-config.json'),JSON.stringify({proxyUrl:'https://proxy.example',appToken:'synthetic',provider:'anthropic'}));
files.set(path.join(root,'device-id'),'11111111-2222-4333-8444-555555555555');
files.set(path.join(root,'brain.key'),'sk-ant-retired-synthetic');
const electron={app,ipcMain:{handle:(n,fn)=>handlers.set(n,fn),on:()=>{}}};
const shippedFeatures=JSON.parse(fs.readFileSync("electron/features.json","utf8"));
assert.equal(shippedFeatures.aiChat,false,"shipping beta must disable AI chat");
const testFeatures={aiChat:true}; // Retain offline regressions for the deferred chat implementation.
const makeContext=()=>vm.createContext({require:n=>n==='./features.json'?testFeatures:n==='electron'?electron:n==='fs'?fakeFs:n==='path'?path:n==='child_process'?{exec:()=>{}}:n==='openai'?{default:SDK}:n==='./calendar.cjs'?calendar:(()=>{throw new Error(`unexpected dependency ${n}`)})(),__dirname:path.resolve('electron'),process:{platform:'darwin',env:{ANTHROPIC_API_KEY:'sk-ant-retired-environment'}},console,AbortController,Buffer,URL,URLSearchParams,setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{}});
const context=makeContext();
vm.runInContext(fs.readFileSync('electron/main.cjs','utf8')+'\nglobalThis.testWindow=w=>{win=w};',context);
const event={sender:{send:(channel,payload)=>events.push({channel,payload})}};
const call=(name,payload)=>handlers.get(name)(event,payload);
const optIn=()=>call('data-save',{settings:{chatConsentVersion:1},chat:{messages:[]}});
const request=id=>call('chat-send',{id,system:[{text:'test'}],messages:[{role:'user',content:'test message'}]});
assert.equal((await request('absent')).error,'privacy-not-accepted');files.set(dataPath,'bad json');assert.equal((await request('corrupt')).error,'privacy-not-accepted');
files.set(dataPath,JSON.stringify({settings:{chatOn:true}}));assert.equal((await request('legacy')).error,'privacy-not-accepted');assert.equal(loads,0);
assert.equal(call('brain-status').provider,'openai');
optIn();const legacyConfigRequest=request('legacy-config');
assert.equal(clientOptions.baseURL,'https://proxy.example/v1','old config still uses only OpenAI route');
assert.equal(clientOptions.apiKey,'unused','retired saved/environment keys never sent');
pending.at(-1).resolve({output:[]});assert.equal((await legacyConfigRequest).ok,true);events.length=0;
await call('brain-connect','sk-proj-synthetic');optIn();
const first=request('first');let p=pending.at(-1);assert.equal(p.body.store,false);assert.ok(!p.body.tools[0].user_location);
call('data-save',{settings:{chatConsentVersion:0}});assert.equal(p.signal.aborted,true);
p.listeners['response.output_text.delta']({delta:'late private reply',output_index:0});p.resolve({output:[]});assert.equal((await first).error,'cancelled');assert.equal(events.length,0,'late result must not be delivered');
optIn();const clear=request('clear');p=pending.at(-1);await call('chat-cancel');p.resolve({output:[]});assert.equal((await clear).error,'cancelled');
optIn();writesFail=true;assert.equal(call('data-save',{settings:{chatConsentVersion:0}}),false);assert.equal((await request('failed-save')).error,'privacy-not-accepted');writesFail=false;
optIn();const normal=request('normal');p=pending.at(-1);p.listeners['response.output_text.delta']({delta:'hello',output_index:0});p.resolve({output:[]});assert.equal((await normal).ok,true);assert.equal(events.at(-1).channel,'chat-done');
assert.equal((await call('brain-once',{prompt:'private'})).error,'background-ai-disabled');assert.equal(call('voice-cloud-info').available,false);
// Unsupported keys are rejected, never saved or sent to the wrong provider.
const beforeKey=files.get(path.join(root,'brain.key'));
assert.equal((await call('brain-connect','sk-ant-synthetic')).ok,false);
assert.equal(files.get(path.join(root,'brain.key')),beforeKey);
assert.equal((await call('brain-connect','')).ok,false);
console.log('PASS: no requests without consent; OpenAI aborts; unsupported keys rejected; late responses discarded; failed save fails closed; no background AI/cloud voice.');

for(const name of ['brain.key','google-tts.key','google-calendar.token.json','google-calendar-client.json','window-state.json','device-id'])files.set(path.join(root,name),'synthetic');
optIn();const beforeReset=request('reset');p=pending.at(-1);let loaded;
context.testWindow({webContents:{once:(_n,fn)=>loaded=fn},reload:()=>{}});
assert.equal(call('data-reset').ok,true);assert.equal(p.signal.aborted,true);p.resolve({output:[]});await beforeReset;
assert.ok(calendarCleared>0);assert.equal(login.openAtLogin,false);
for(const name of ['companion-data.json','brain.key','google-tts.key','google-calendar.token.json','google-calendar-client.json','window-state.json','device-id'])assert.equal(files.has(path.join(root,name)),false,name);
assert.equal(optIn(),false,'old renderer must not recreate deleted data during reload');loaded();assert.equal((await request('after-reset')).error,'privacy-not-accepted');
optIn();deleteFail=true;assert.equal(call('data-reset').ok,false);assert.equal(optIn(),false,'partial deletion must not be reported successful or restored');deleteFail=false;assert.equal(call('data-reset').ok,true);loaded();
console.log('PASS: full reset removes synthetic personal files, cancels requests, blocks stale writes and reports deletion failures honestly.');

// Fresh runtime with the real release gate: old consent/keys/config cannot opt in.
testFeatures.aiChat=false;
files.set(dataPath,JSON.stringify({settings:{chatConsentVersion:1}}));
files.set(path.join(root,'brain.key'),'sk-proj-existing-synthetic');
const betaContext=makeContext();
vm.runInContext(fs.readFileSync('electron/main.cjs','utf8'),betaContext);
const beforeLoads=loads;
assert.equal(call('brain-status').connected,false);
assert.equal(call('brain-status').viaProxy,false);
assert.equal((await request('beta')).error,'chat-disabled-in-beta');
assert.equal((await call('brain-connect','sk-proj-new-synthetic')).ok,false);
assert.equal(files.get(path.join(root,'brain.key')),'sk-proj-existing-synthetic','do not overwrite owner keys');
assert.equal((await call('brain-once',{})).ok,false);
assert.equal(call('voice-cloud-info').available,false);
assert.equal(loads,beforeLoads,'beta must not invoke any AI provider');
assert.ok(!JSON.parse(fs.readFileSync('package.json','utf8')).build.files.includes('electron/beta-config.json'));
assert.ok(JSON.parse(fs.readFileSync('package.json','utf8')).build.files.includes('!electron/beta-config.json'));
console.log('PASS: shipping beta blocks chat despite prior consent, saved keys and proxy config; no AI requests or credential writes.');
