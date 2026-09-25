'use strict';

// Base conversion mode: decimal, binary, hex, octal. Behaviour is carried
// over unchanged from the original single-file app.js.

import { normalizeInput, groupFromRight, randInt } from '../format.js';

const B = { dec: 10, bin: 2, hex: 16, oct: 8 };
const NAME = { dec: 'decimal', bin: 'binary', hex: 'hex', oct: 'octal' };
const BITS = { bin: 1, oct: 3, hex: 4 };
const ORDER = ['dec', 'bin', 'hex', 'oct'];

function raw(n, b) { return n.toString(B[b]).toUpperCase(); }

function fmt(n, b) {
  let s = raw(n, b);
  if (b === 'bin' && s.length > 4) {
    s = groupFromRight(s, 4).join(' ');
  }
  return s;
}

function parseAns(s, b) {
  s = normalizeInput(s, { hex: '0x', bin: '0b', oct: '0o' }[b]);
  if (!s) return null;
  const ok = { dec: /^[0-9]+$/, bin: /^[01]+$/, oct: /^[0-7]+$/, hex: /^[0-9a-f]+$/ }[b];
  if (!ok.test(s)) return NaN;
  return parseInt(s, B[b]);
}

function work(p) {
  const n = p.value, f = p.from, t = p.to, L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  const src = raw(n, f);

  if (f === 'dec') {
    note(`Divide by ${B[t]} over and over. Each remainder is the next digit, starting from the right.`);
    let x = n;
    while (x > 0) {
      const q = Math.floor(x / B[t]), r = x % B[t];
      line(`${x} &divide; ${B[t]} = ${q}  remainder ${r}${r > 9 ? ' (' + r.toString(16).toUpperCase() + ')' : ''}`);
      x = q;
    }
    line(`<span class="res">Remainders bottom to top: ${fmt(n, t)}</span>`);
  } else if (t === 'dec') {
    note(`Multiply each digit by ${B[f]} to the power of its position (rightmost is position 0), then add. Zero digits are skipped.`);
    const d = src.split(''), len = d.length, parts = [];
    d.forEach((c, i) => {
      const v = parseInt(c, 16), pw = len - 1 - i;
      if (v === 0) return;
      const place = B[f] ** pw;
      line(`${c}${v > 9 ? ' (' + v + ')' : ''} &times; ${B[f]}<sup>${pw}</sup> = ${v} &times; ${place} = ${v * place}`);
      parts.push(v * place);
    });
    line(`<span class="res">${parts.join(' + ')} = ${n}</span>`);
  } else if (f === 'bin') {
    const g = BITS[t];
    note(`Group the bits in ${g}s from the right (pad the left with zeros), then convert each group.`);
    groupFromRight(src, g).forEach(gp => line(`${gp} = ${parseInt(gp, 2).toString(B[t]).toUpperCase()}`));
    line(`<span class="res">Result: ${fmt(n, t)}</span>`);
  } else if (t === 'bin') {
    const g = BITS[f];
    note(`Write each ${NAME[f]} digit as exactly ${g} bits, then join them.`);
    src.split('').forEach(c => line(`${c} = ${parseInt(c, B[f]).toString(2).padStart(g, '0')}`));
    line(`<span class="res">Joined, leading zeros dropped: ${fmt(n, 'bin')}</span>`);
  } else {
    const g1 = BITS[f], g2 = BITS[t];
    note(`Go through binary. First write each ${NAME[f]} digit as ${g1} bits.`);
    src.split('').forEach(c => line(`${c} = ${parseInt(c, B[f]).toString(2).padStart(g1, '0')}`));
    const bin = n.toString(2);
    line(`Binary: ${bin}`);
    note(`Now regroup in ${g2}s from the right and convert each group to ${NAME[t]}.`);
    groupFromRight(bin, g2).forEach(gp => line(`${gp} = ${parseInt(gp, 2).toString(B[t]).toUpperCase()}`));
    line(`<span class="res">Result: ${fmt(n, t)}</span>`);
  }
  return L.join('');
}

const RANGES = ['15', '255', '4095', '65535'];

export default {
  id: 'base',
  label: 'Base conversion',

  defaults: { bases: ['dec', 'bin', 'hex', 'oct'], range: '255' },

  renderOptions(settings) {
    const s = { ...this.defaults, ...settings };
    const check = v => s.bases.includes(v) ? 'checked' : '';
    const opt = (v, sel, label) => `<option value="${v}"${v === sel ? ' selected' : ''}>${label}</option>`;
    return `
      <fieldset>
        <legend>Bases to include</legend>
        <div class="checks">
          <label><input type="checkbox" name="base" value="dec" ${check('dec')}> Decimal</label>
          <label><input type="checkbox" name="base" value="bin" ${check('bin')}> Binary</label>
          <label><input type="checkbox" name="base" value="hex" ${check('hex')}> Hex</label>
          <label><input type="checkbox" name="base" value="oct" ${check('oct')}> Octal</label>
        </div>
      </fieldset>
      <div>
        <label class="lbl" for="range">Number size</label>
        <select id="range" name="range">
          ${opt('15', s.range, 'Up to 15 (one hex digit)')}
          ${opt('255', s.range, 'Up to 255 (one byte)')}
          ${opt('4095', s.range, 'Up to 4095 (12 bits)')}
          ${opt('65535', s.range, 'Up to 65535 (two bytes)')}
        </select>
      </div>`;
  },

  readOptions(root) {
    const bases = [...root.querySelectorAll('input[name=base]:checked')].map(i => i.value);
    const range = root.querySelector('#range')?.value ?? this.defaults.range;
    return { bases, range: RANGES.includes(range) ? range : this.defaults.range };
  },

  settingsFromParams(params, current) {
    const s = { ...current };
    if (params.has('bases')) {
      const bases = params.get('bases').split(',').map(v => v.trim()).filter(v => ORDER.includes(v));
      if (bases.length) s.bases = bases;
    }
    if (params.has('range') && RANGES.includes(params.get('range'))) s.range = params.get('range');
    return s;
  },

  generate(settings, count) {
    const bases = settings.bases;
    if (bases.length < 2) return { error: 'Select at least two bases to convert between.' };
    const max = +settings.range;
    const pairs = [];
    bases.forEach(a => bases.forEach(b => { if (a !== b) pairs.push([a, b]); }));

    const seen = new Set();
    const problems = [];
    let guard = 0;
    while (problems.length < count && guard < 5000) {
      guard++;
      const [from, to] = pairs[randInt(0, pairs.length - 1)];
      const value = randInt(max > 15 ? 8 : 2, max);
      const k = from + to + value;
      if (seen.has(k)) continue;
      seen.add(k);
      problems.push({ from, to, value });
    }
    return problems;
  },

  prompt(p) {
    return {
      valueHtml: `${fmt(p.value, p.from)}<sub>${B[p.from]}</sub>`,
      directionText: `${NAME[p.from]} to ${NAME[p.to]}`,
      answerLabel: `answer in ${NAME[p.to]}`,
      inputmode: p.to === 'hex' ? 'text' : 'numeric',
    };
  },

  check(p, input) {
    const v = parseAns(input, p.to);
    if (v === null) return { status: 'empty', message: '' };
    if (Number.isNaN(v)) return { status: 'invalid', message: `That isn't a valid ${NAME[p.to]} number.` };
    if (v === p.value) return { status: 'correct', message: 'Correct' };
    return { status: 'wrong', message: `Not quite. Answer: <span class="mono">${fmt(p.value, p.to)}</span>` };
  },

  answer(p) { return fmt(p.value, p.to); },

  work(p) { return work(p); },

  statKey(p) { return `base:${p.from}-${p.to}`; },

  statLabel(key) {
    const m = key.match(/^base:(dec|bin|hex|oct)-(dec|bin|hex|oct)$/);
    if (!m) return null;
    return `${NAME[m[1]]} to ${NAME[m[2]]}`;
  },

  lessonAnchor(p) {
    if (p.to === 'dec') return 'lesson-2';
    if (p.from === 'dec') return 'lesson-3';
    if ((p.from === 'hex' && p.to === 'oct') || (p.from === 'oct' && p.to === 'hex')) return 'lesson-5';
    return 'lesson-4';
  },
};
