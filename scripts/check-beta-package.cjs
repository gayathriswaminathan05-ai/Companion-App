const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const asar=require('@electron/asar');
const resources=path.resolve(process.argv[2]||'release/0.1.1-beta.2/mac-arm64/Companion.app/Contents/Resources');
const archive=path.join(resources,'app.asar'),files=asar.listPackage(archive);
const {execFileSync}=require('child_process');
const minimum=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :LSMinimumSystemVersion',path.join(resources,'..','Info.plist')],{encoding:'utf8'}).trim();
assert.equal(minimum,'14.0','dictation runtime requires macOS14');
const read=p=>asar.extractFile(archive,p).toString();
assert.equal(JSON.parse(read('package.json')).version,'0.1.1-beta.2');
assert.equal(JSON.parse(read('electron/features.json')).aiChat,false);
const disallowed=files.filter(f=>/\.key$|\/\.env(?:\.|$)|beta-config\.json|companion-data\.json|google-calendar.*\.json|window-state\.json|\/device-id$|\/test-[^/]+\.cjs$|\/\.git\//i.test(f));
assert.deepEqual(disallowed,[],'private/test files must not ship');
assert.ok(!files.some(f=>f.includes('@anthropic-ai')));
// Desktop OAuth client metadata is required by the approved Calendar feature.
// It must contain only the app registration, never access/refresh tokens.
const client=JSON.parse(read('electron/google-client.json'));
assert.deepEqual(Object.keys(client).sort(),['clientId','clientSecret']);
assert.match(client.clientId,/\.apps\.googleusercontent\.com$/);
assert.doesNotMatch(JSON.stringify(client),/access_token|refresh_token/);
for(const [name,text] of files.filter(f=>/^\/electron\/.*\.(cjs|json)$/.test(f)&&!f.endsWith('google-client.json')).map(f=>[f,read(f.slice(1))])){
 assert.doesNotMatch(text,/sk-(?:proj-|ant-)[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,`credential found in ${name}`);
}
assert.match(read('electron/voice.cjs'),/env.allowRemoteModels = false/);
assert.match(read('electron/main.cjs'),/env.allowRemoteModels = false/);
for(const f of ['Xenova/whisper-base.en/onnx/encoder_model.onnx','Xenova/whisper-base.en/onnx/decoder_model_merged.onnx','onnx-community/Kokoro-82M-v1.0-ONNX/onnx/model_quantized.onnx'])assert.ok(fs.statSync(path.join(resources,'models',f)).size>1000000,f);
for(const v of ['af_heart','af_bella','af_sky'])assert.ok(files.includes(`/node_modules/kokoro-js/voices/${v}.bin`));
for(const stage of [1,2,3,5,6,7])assert.ok(files.includes(`/dist/character/meditate${stage}/f-001.webp`));
for(const d of ['', '-3m','-5m'])assert.ok(files.includes(`/dist/audio/meditation-guided-v2${d}.m4a`));
// Every literal sprite reference in the optimized build resolves inside ASAR.
const js=files.filter(f=>/^\/dist\/assets\/.*\.js$/.test(f)).map(f=>read(f.slice(1))).join('\n');
const refs=[...js.matchAll(/\.\/character\/[\w/-]+\.webp/g)].map(m=>'/dist/'+m[0].slice(2));
assert.ok(refs.length>6000);assert.deepEqual(refs.filter(f=>!files.includes(f)),[]);
const report={version:'0.1.1-beta.2',files:files.length,spriteReferences:refs.length,aiChat:false,voiceRemoteFallback:false,privateFiles:0,googleClient:'clientId/clientSecret only; no user tokens; Console registration type requires verification',models:'bundled Whisper and Kokoro',appAsarSha256:crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')};
const out=path.resolve('docs/qa/2026-10-19/release-0.1.1-beta.2');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'package-audit.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
