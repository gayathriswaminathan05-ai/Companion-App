// Offline OAuth regression: real loopback callback, synthetic client/tokens.
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-oauth-test-'));
fs.writeFileSync(path.join(temp,'google-calendar-client.json'),JSON.stringify({clientId:'synthetic-client',clientSecret:'synthetic-desktop-registration'}));
let authorization,previousState,previousChallenge,mode='success',exchanges=0;
const request=url=>new Promise((resolve,reject)=>{http.get(url,res=>{res.resume();res.on('end',()=>resolve(res.statusCode))}).on('error',reject)});
const shell={openExternal:async raw=>{
 const u=new URL(raw);authorization=u;assert.equal(u.hostname,'accounts.google.com');
 assert.equal(u.searchParams.get('scope'),'https://www.googleapis.com/auth/calendar.events.readonly');
 const state=u.searchParams.get('state'),challenge=u.searchParams.get('code_challenge');
 assert.match(state,/^[A-Za-z0-9_-]{43}$/);assert.match(challenge,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(state,previousState);assert.notEqual(challenge,previousChallenge);previousState=state;previousChallenge=challenge;
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.has('code_verifier'),false);
 const redirect=u.searchParams.get('redirect_uri');
 const before=exchanges;
 assert.equal(await request(redirect+'/?code=forged&state=wrong'),400);assert.equal(exchanges,before);
 assert.equal(await request(redirect+'/?code=forged'),400);assert.equal(exchanges,before);
 const q=new URLSearchParams(mode==='deny'?{error:'access_denied',state}:{code:'synthetic-authorization-code',state});
 assert.equal(await request(redirect+'/?'+q),200);
}};
const context=vm.createContext({require:n=>n==='electron'?{shell,ipcMain:{handle(){}}}:n==='./gmail.cjs'?{createGmailWatcher:()=>({})}:n==='./features.json'?{aiChat:false}:require(n),__dirname:path.resolve('electron'),module:{exports:{}},console,process,URLSearchParams,URL,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,
 fetch:async(url,opts)=>{exchanges++;assert.equal(url,'https://oauth2.googleapis.com/token');const b=opts.body;assert.equal(b.get('code'),'synthetic-authorization-code');assert.equal(b.get('client_id'),'synthetic-client');const verifier=b.get('code_verifier');assert.match(verifier,/^[A-Za-z0-9_-]{43}$/);assert.equal(crypto.createHash('sha256').update(verifier).digest('base64url'),authorization.searchParams.get('code_challenge'));return {ok:true,json:async()=>({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/calendar.events.readonly'})};}});
vm.runInContext(fs.readFileSync('electron/calendar.cjs','utf8')+`\nuserDataPath=()=>${JSON.stringify(temp)};module.exports.connect=runOAuthConnect;`,context);
(async()=>{await context.module.exports.connect();assert.equal(exchanges,1);await context.module.exports.connect();assert.equal(exchanges,2);mode='deny';await assert.rejects(context.module.exports.connect(),/access_denied/);assert.equal(exchanges,2);console.log('PASS OAuth: unique state/PKCE per connection; missing/wrong state ignored; matching verifier sent only to token endpoint; denied access makes no exchange; read-only scope.');})().catch(e=>{console.error(e);process.exitCode=1});
