// Compare local voices without paid services or downloads. Preserve takes.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),entry=require.resolve('kokoro-js');
const {env}=createRequire(entry)('@huggingface/transformers');
env.localModelPath=path.resolve('models');env.allowLocalModels=true;env.allowRemoteModels=false;
globalThis.fetch=async()=>{throw new Error('Voice comparison is offline only')};
const {KokoroTTS}=require(entry),tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'cpu'});
const line="Hey, you! Look at you, getting things done. Tiny victory dance? And then, how about a little walk together?";
fs.mkdirSync('public/audio/voice-options',{recursive:true});
for(const [label,voice,speed] of [['light-original','af_sky',1.05],['bubbly-friend','af_bella',1]]) {
 const dest=path.resolve(`public/audio/voice-options/${label}-v1.m4a`);if(fs.existsSync(dest))continue;
 const result=await tts.generate(line,{voice,speed});
 const tmp=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'plant-voice-')),'take.f32');fs.writeFileSync(tmp,Buffer.from(result.audio.buffer,result.audio.byteOffset,result.audio.byteLength));
 execFileSync(require('ffmpeg-static'),['-v','error','-f','f32le','-ar',String(result.sampling_rate),'-ac','1','-i',tmp,'-c:a','aac','-b:a','96k',dest]);console.log('Created local sample:',label);
}
await tts.model.dispose();
