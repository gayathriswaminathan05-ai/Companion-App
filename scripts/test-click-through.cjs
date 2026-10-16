// Exercise the actual renderer request function and native IPC handler together.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const main = fs.readFileSync('electron/main.cjs', 'utf8');
const renderer = fs.readFileSync('src/App.tsx', 'utf8');
let handler;
const calls = [];
const context = vm.createContext({
  win: { setIgnoreMouseEvents: value => calls.push(value) },
  ipcMain: { on: (_name, fn) => { handler = fn; } },
});
vm.runInContext(main.slice(main.indexOf('let clickThroughWindow'), main.indexOf('// CSS client coords')), context);
const applyBody = renderer.match(/const apply = \(ignore: boolean\) => \{([\s\S]*?)\n    \};/)[1];
const apply = new Function('window', 'ignore', applyBody).bind(null, {
  companion: { setClickThrough: value => handler({}, value) },
});
apply(false); // pointer over Start
handler({}, true); // resize completion changes native state outside this effect
apply(false); // same pointer returns to Start: must restore clicks
assert.deepEqual(calls, [false, true, false]);
apply(false); apply(false);
assert.equal(calls.length, 3, 'repeated polls do not repeat native window updates');
context.win = { setIgnoreMouseEvents: value => calls.push(value) };
apply(false);
assert.equal(calls.length, 4, 'a replacement window receives its initial state');
console.log('PASS: clicks recover after resize; native deduplication; replacement window.');
