import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'companion-breathing-')), 'breathing.mjs');
await build({ input: 'src/breathing.ts', platform: 'node', logLevel: 'silent', output: { file, format: 'esm' } });
const { breathingStep, BREATHING_VOICE_CUES } = await import(pathToFileURL(file));
for (const [ms, phase, remaining] of [[0, 'settle', 60], [4999, 'settle', 56], [5000, 'in', 55], [8999, 'in', 52], [9000, 'out', 51], [13000, 'in', 47], [52999, 'out', 8], [53000, 'finish', 7], [60000, 'done', 0], [100000, 'done', 0]]) {
  assert.equal(breathingStep(ms).phase, phase, `phase at ${ms}`);
  assert.equal(breathingStep(ms).remaining, remaining, `remaining at ${ms}`);
}
console.log('Breathing timeline: settling, six complete cycles, natural-breath ending and completion passed.');
for (const version of ['v1', 'v2']) {
const audio = JSON.parse(fs.readFileSync(`public/audio/meditation-${version}-cues.json`, 'utf8'));
for (const [mode, cues] of Object.entries(BREATHING_VOICE_CUES)) {
  assert.deepEqual(audio.tracks[mode].map(({ at, text }) => ({ at, text })), cues, 'spoken script matches source');
  for (let i = 0; i < cues.length; i++) {
    const take = audio.tracks[mode][i];
    assert.ok(take.duration > 0);
    assert.ok(take.at + take.duration < (cues[i + 1]?.at ?? 60), 'speech leaves space before next cue');
    if (mode === 'guided' && take.at >= 5 && take.at < 53) {
      assert.equal(breathingStep(take.at * 1000).phase, i % 2 === 1 ? 'in' : 'out', 'voice matches visual breathing phase');
    }
  }
}
}
console.log('Bundled spoken scripts match the timeline and every cue fits without overlap.');
for (const minutes of [3,5]) {
  const duration = minutes * 60_000;
  assert.equal(breathingStep(duration - 7001, duration).phase, 'out');
  assert.equal(breathingStep(duration - 7000, duration).phase, 'finish');
  assert.equal(breathingStep(duration, duration).phase, 'done');
  assert.equal(breathingStep(0, duration).remaining, minutes * 60);
}
console.log('Three- and five-minute sessions preserve complete breathing cycles and the ending.');
