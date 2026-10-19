const {app,BrowserWindow,session}=require('electron');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 app.dock?.hide();session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,c)=>c({cancel:true}));
 const out=path.resolve('docs/qa/2026-10-19/release-0.1.1-beta.1');fs.mkdirSync(out,{recursive:true});
 try{for(const [name,file] of [['guide','docs/tester-guide/tester-guide.html'],['privacy','site/privacy.html']]){
 for(const width of [1100,390]){
 const w=new BrowserWindow({show:false,width,height:900,webPreferences:{offscreen:true}});await w.loadFile(path.resolve(file));await new Promise(r=>setTimeout(r,300));
 const state=await w.webContents.executeJavaScript(`({overflow:document.documentElement.scrollWidth>innerWidth, broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,body:document.body.textContent})`);
 assert.equal(state.overflow,false,name+width);assert.equal(state.broken,0);assert.ok(state.body.includes('0.1.1-beta.1'));assert.ok(state.body.includes('AI chat'));assert.ok(!state.body.includes('cloud speech by Google'));
 fs.writeFileSync(path.join(out,`${name}-${width}.png`),(await w.webContents.capturePage()).toPNG());w.destroy();
 }}console.log('PASS beta guide/privacy desktop and phone: no overflow/broken images; no external fonts or scripts.');app.exit(0)}catch(e){console.error(e);app.exit(1)}
});
