'use strict';

// Runnable with `node tests/run.mjs`. No dependencies.
// Generates problems across every mode and option combination, asserts
// check(problem, answer(problem)) is always correct, verifies every float
// bit pattern against DataView, and checks a handful of hand-picked cases.

import base from '../js/types/base.js';
import signed from '../js/types/signed.js';
import float from '../js/types/float.js';

let pass = 0, fail = 0;
const failures = [];

function ok(desc, cond) {
  if (cond) { pass++; }
  else { fail++; failures.push(desc); }
}

function extractAnswerInput(mode, p) {
  if (mode.id === 'signed' && p.direction === 'toDec') {
    return p.negZero ? '-0' : p.value.toString();
  }
  const raw = mode.answer(p);
  if (typeof raw !== 'string') return String(raw);
  return raw.includes('<') ? raw.replace(/<[^>]+>/g, ' ') : raw;
}

function checkRoundTrip(mode, settings, count, label) {
  const problems = mode.generate(settings, count);
  if (problems && problems.error) return; // e.g. base mode with < 2 bases selected
  let bad = 0;
  for (const p of problems) {
    const input = extractAnswerInput(mode, p);
    const r = mode.check(p, input);
    if (r.status !== 'correct') {
      bad++;
      if (failures.length < 40) failures.push(`${label}: ${JSON.stringify(p, (k, v) => typeof v === 'bigint' ? v.toString() : v)} input=${JSON.stringify(input)} -> ${JSON.stringify(r)}`);
    }
    // exercise work() and prompt() for crashes
    mode.prompt(p);
    mode.work(p);
    if (mode.lessonAnchor) mode.lessonAnchor(p);
    if (mode.statKey) mode.statKey(p);
  }
  ok(`${label}: ${problems.length - bad}/${problems.length} round-trip correct`, bad === 0);
}

/* ---------- base mode: every base subset and range ---------- */
const BASE_ORDER = ['dec', 'bin', 'hex', 'oct'];
function subsets(arr) {
  const out = [];
  for (let mask = 0; mask < (1 << arr.length); mask++) {
    const s = arr.filter((_, i) => mask & (1 << i));
    if (s.length >= 2) out.push(s);
  }
  return out;
}
for (const bases of subsets(BASE_ORDER)) {
  for (const range of ['15', '255', '4095', '65535']) {
    checkRoundTrip(base, { bases, range }, 60, `base bases=${bases.join(',')} range=${range}`);
  }
}
checkRoundTrip(base, { bases: ['dec'], range: '255' }, 5, 'base single-base guard');

/* ---------- signed mode: every rep, width, direction set, format ---------- */
const SIGNED_DIRECTION_SETS = [
  ['toBits'], ['toDec'], ['toBits', 'toDec'],
  ['toBits', 'toDec', 'convert'], ['convert'],
];
for (const rep of ['ones', 'twos', 'both']) {
  for (const width of [8, 16, 32, 64]) {
    for (const directions of SIGNED_DIRECTION_SETS) {
      for (const format of ['bin', 'hex']) {
        checkRoundTrip(signed, { rep, width: String(width), directions, format }, 40,
          `signed rep=${rep} width=${width} dir=${directions.join('+')} fmt=${format}`);
      }
    }
  }
}

/* ---------- float mode: every precision, direction set, split, specials ---------- */
const FLOAT_DIRECTION_SETS = [['toBits'], ['toDec'], ['toBits', 'toDec']];
for (const precision of ['single', 'double', 'both']) {
  for (const directions of FLOAT_DIRECTION_SETS) {
    for (const splitInput of [false, true]) {
      for (const includeSpecials of [false, true]) {
        checkRoundTrip(float, { precision, directions, splitInput, includeSpecials }, 60,
          `float precision=${precision} dir=${directions.join('+')} split=${splitInput} specials=${includeSpecials}`);
      }
    }
  }
}

/* ---------- float bit patterns always match DataView ---------- */
{
  let bad = 0, n = 0;
  const probs = float.generate({ precision: 'both', directions: ['toBits', 'toDec'], splitInput: false, includeSpecials: true }, 500);
  for (const p of probs) {
    n++;
    const buf = new ArrayBuffer(p.precision === 'single' ? 4 : 8);
    const dv = new DataView(buf);
    let decoded;
    if (p.precision === 'single') { dv.setUint32(0, Number(p.bits), false); decoded = dv.getFloat32(0, false); }
    else { dv.setBigUint64(0, p.bits, false); decoded = dv.getFloat64(0, false); }
    const match = Object.is(decoded, p.value) || decoded === p.value;
    if (!match) { bad++; failures.push(`DataView mismatch: ${p.precision} bits=${p.bits.toString(16)} value=${p.value} decoded=${decoded}`); }
  }
  ok(`float bit patterns match DataView (${n - bad}/${n})`, bad === 0);
}

/* ---------- hand-picked known cases ---------- */
{
  const p = float.example({ precision: 'single', direction: 'toBits', value: -13.625 });
  ok('-13.625 as float32 is C15A0000', float.answer(p) === 'C15A0000');
}
{
  const p = signed.example({ repr: 'twos', width: 8, direction: 'toBits', value: -1 });
  ok("-1 in 8-bit two's complement is 11111111", signed.answer(p).replace(/\s/g, '') === '11111111');
}
{
  const p = signed.example({ repr: 'ones', width: 8, direction: 'toBits', value: -1 });
  ok("-1 in 8-bit one's complement is 11111110", signed.answer(p).replace(/\s/g, '') === '11111110');
}
{
  const p = float.example({ precision: 'double', direction: 'toBits', value: 0.1875 });
  ok('0.1875 as float64 is 3FC8000000000000', float.answer(p) === '3FC8000000000000');
}

/* ---------- summary ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(' - ' + f));
}
process.exit(fail ? 1 : 0);
