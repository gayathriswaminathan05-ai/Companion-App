// Reuse existing local recordings. No models, network or generation credits.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),ff=require('ffmpeg-static');
const root=path.resolve(__dirname,'../public/audio'),rate=24000;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'meditation-long-'));
const cues=JSON.parse(fs.readFileSync(path.join(root,'meditation-v2-cues.json'))).tracks;
for(const mode of ['guided','ownPace']) {
 const decoded=path.join(tmp,mode+'.f32');
 execFileSync(ff,['-v','error','-i',path.join(root,`meditation-${mode}-v2.m4a`),'-f','f32le','-ar',String(rate),'-ac','1',decoded]);
 const buf=fs.readFileSync(decoded),source=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4);
 for(const minutes of [3,5]) {
  const dest=path.join(root,`meditation-${mode}-v2-${minutes}m.m4a`);
  if(fs.existsSync(dest)) {console.log('Preserved',path.basename(dest));continue;}
  const duration=minutes*60,out=new Float32Array(duration*rate);
  const copy=(from,to,at)=>out.set(source.slice(Math.round(from*rate),Math.round(to*rate)),Math.round(at*rate));
  if(mode==='guided') {
   copy(0,5,0);
   for(let at=5;at<duration-7;at+=8)copy(5,13,at);
   copy(53,60,duration-7);
  } else {
   copy(0,cues.ownPace[0].duration+0.1,0);
   for(let at=17,i=0;at<duration-10;at+=20,i++) {
    const cue=cues.ownPace[1+i%2];copy(cue.at,cue.at+cue.duration+0.1,at);
   }
   copy(53,60,duration-7);
  }
  const raw=path.join(tmp,`${mode}-${minutes}.f32`);fs.writeFileSync(raw,Buffer.from(out.buffer));
  execFileSync(ff,['-v','error','-f','f32le','-ar',String(rate),'-ac','1','-i',raw,'-c:a','aac','-b:a','64k',dest]);
  console.log('Created',path.basename(dest));
 }
}
