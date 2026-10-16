// Generate the fixed meditation tracks using ONLY the existing local model.
// No API, download, cloud voice or paid generation. Bump filenames for new takes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'rolldown';
const require = createRequire(import.meta.url);
const soft = process.argv.includes('--soft');
const version = soft ? 'v2' : 'v1';
const voice = soft ? 'af_sky' : 'af_heart';
const speed = soft ? 0.78 : 0.92;
const root = path.resolve(import.meta.dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-meditation-'));
const moduleFile = path.join(scratch, 'breathing.mjs');
await build({ input: path.join(root, 'src/breathing.ts'), platform: 'node', logLevel: 'silent', output: { file: moduleFile, format: 'esm' } });
const { BREATHING_DURATION_MS, BREATHING_VOICE_CUES } = await import(pathToFileURL(moduleFile));
const entry = require.resolve('kokoro-js');
const { env } = createRequire(entry)('@huggingface/transformers');
env.localModelPath = path.join(root, 'models');
env.allowLocalModels = true;
env.allowRemoteModels = false;
// Fail closed if any dependency attempts a network fetch.
globalThis.fetch = async () => { throw new Error('Meditation audio generation is offline only.'); };
const { KokoroTTS } = require(entry);
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
const out = path.join(root, 'public/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 24000;
const takes = new Map();
const report = {};
for (const [mode, cues] of Object.entries(BREATHING_VOICE_CUES)) {
  const destination = path.join(out, `meditation-${mode}-${version}.m4a`);
  if (fs.existsSync(destination)) throw new Error(`Preserve existing take: ${destination}. Use a new version name.`);
  const track = new Float32Array(rate * BREATHING_DURATION_MS / 1000);
  report[mode] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!takes.has(cue.text)) {
      const result = await tts.generate(cue.text, { voice, speed });
      if (result.sampling_rate !== rate) throw new Error('Unexpected sample rate');
      let a = 0, b = result.audio.length;
      while (a < b && Math.abs(result.audio[a]) < 0.003) a++;
      while (b > a && Math.abs(result.audio[b - 1]) < 0.003) b--;
      const pcm = result.audio.slice(Math.max(0, a - 240), Math.min(result.audio.length, b + 1200));
      if (!pcm.length) throw new Error('Empty voice take');
      takes.set(cue.text, pcm);
    }
    const pcm = takes.get(cue.text);
    const end = cue.at + pcm.length / rate;
    const next = cues[i + 1]?.at ?? BREATHING_DURATION_MS / 1000;
    if (end > next - 0.15) throw new Error(`Voice overlaps next cue: ${cue.text} (${end}s > ${next}s)`);
    track.set(pcm, Math.round(cue.at * rate));
    report[mode].push({ ...cue, duration: Number((pcm.length / rate).toFixed(3)) });
  }
  const raw = path.join(scratch, `${mode}.f32`);
  fs.writeFileSync(raw, Buffer.from(track.buffer));
  const treatment = soft ? ['-af', 'highpass=f=75,lowpass=f=6500,volume=0.9'] : [];
  execFileSync(require('ffmpeg-static'), ['-loglevel', 'error', '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', raw, ...treatment, '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', destination]);
  console.log(`Created ${path.relative(root, destination)} (60 seconds, all cues fit with silence between)`);
}
fs.writeFileSync(path.join(out, `meditation-${version}-cues.json`), JSON.stringify({ voice, speed, duration: 60, tracks: report }, null, 2) + '\n');
await tts.model.dispose();
