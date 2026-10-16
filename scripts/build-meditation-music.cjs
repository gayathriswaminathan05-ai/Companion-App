// Original ambient accompaniment, synthesized locally without samples or APIs.
// Gentle sustained chords and sparse bell tones. Preserve v1 when making variants.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const destination = path.resolve(__dirname, '../public/audio/meditation-music-v1.m4a');
if (fs.existsSync(destination)) throw new Error('Keep the original music take; use a new version filename.');
const rate = 24000, seconds = 60;
const pcm = new Float32Array(rate * seconds * 2);
const chords = [[130.8128, 195.9977, 246.9417, 293.6648], [110, 164.8138, 220, 261.6256, 329.6276]];
const bells = [[11, 523.2511], [27, 659.2551], [43, 587.3295]];
let peak = 0;
for (let n = 0; n < rate * seconds; n++) {
  const t = n / rate;
  const fade = Math.min(1, t / 5, (seconds - t) / 7);
  const envelope = Math.sin(Math.max(0, fade) * Math.PI / 2) ** 2;
  const blend = (1 - Math.cos(2 * Math.PI * t / seconds)) / 2;
  for (let channel = 0; channel < 2; channel++) {
    let value = 0;
    chords.forEach((chord, c) => {
      const weight = c ? blend : 1 - blend;
      chord.forEach((freq, i) => {
        const phase = 2 * Math.PI * freq * (channel ? 1.0006 : 0.9994) * t;
        const breath = 0.9 + 0.1 * Math.sin(t * 0.35 + i);
        value += weight * breath * (Math.sin(phase) + 0.12 * Math.sin(2 * phase)) / chord.length;
      });
    });
    for (const [at, freq] of bells) {
      const dt = t - at;
      if (dt >= 0 && dt < 8) value += 0.09 * (1 - Math.exp(-dt * 10)) * Math.exp(-dt / 2) * Math.sin(2 * Math.PI * freq * dt);
    }
    value *= 0.22 * envelope;
    pcm[n * 2 + channel] = value;
    peak = Math.max(peak, Math.abs(value));
  }
}
if (peak > 0.3) throw new Error(`Unexpected music peak: ${peak}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-music-'));
const raw = path.join(tmp, 'ambient.f32');
fs.writeFileSync(raw, Buffer.from(pcm.buffer));
fs.mkdirSync(path.dirname(destination), { recursive: true });
execFileSync(require('ffmpeg-static'), ['-loglevel', 'error', '-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', raw, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', destination]);
console.log(`Created original 60s ambient track; peak ${peak.toFixed(3)}, gentle fade in/out.`);
