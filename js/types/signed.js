'use strict';

// Signed integers mode: ones' complement and two's complement.
// All bit-pattern and range arithmetic uses BigInt.

import { normalizeInput, groupFromRight, groupBitsDisplay, invertBits, randBigInt } from '../format.js';

const WIDTHS = [8, 16, 32, 64];
const REPRS = ['ones', 'twos', 'both'];
const FORMATS = ['bin', 'hex'];
const DIRECTIONS = ['toBits', 'toDec', 'convert'];

const REPR_NAME = { ones: "one's complement", twos: "two's complement" };

function maxMag(width) { return (1n << BigInt(width - 1)) - 1n; } // largest magnitude both reprs share
function twosMin(width) { return -(1n << BigInt(width - 1)); }
function twosMax(width) { return (1n << BigInt(width - 1)) - 1n; }
function onesMin(width) { return -maxMag(width); }
function onesMax(width) { return maxMag(width); }

function encodeTwos(value, width) {
  const mod = 1n << BigInt(width);
  let v = value % mod;
  if (v < 0n) v += mod;
  return v.toString(2).padStart(width, '0');
}
function decodeTwos(bits, width) {
  const v = BigInt('0b' + bits);
  const signBit = 1n << BigInt(width - 1);
  return (v & signBit) ? v - (1n << BigInt(width)) : v;
}
function encodeOnes(value, width) {
  if (value === 0n) return '0'.repeat(width);
  const mag = value < 0n ? -value : value;
  const magBits = mag.toString(2).padStart(width, '0');
  return value < 0n ? invertBits(magBits) : magBits;
}
function decodeOnes(bits, width) {
  const allOnes = '1'.repeat(width);
  if (bits === allOnes) return 0n; // negative zero
  if (bits[0] === '1') return -BigInt('0b' + invertBits(bits));
  return BigInt('0b' + bits);
}
function encode(value, repr, width) { return repr === 'twos' ? encodeTwos(value, width) : encodeOnes(value, width); }
function decode(bits, repr, width) { return repr === 'twos' ? decodeTwos(bits, width) : decodeOnes(bits, width); }

function toHex(bits, width) {
  return BigInt('0b' + bits).toString(16).toUpperCase().padStart(width / 4, '0');
}

function displayBits(bits, width, format) {
  return format === 'hex' ? toHex(bits, width) : groupBitsDisplay(bits);
}

function randomSigned(min, max, negBias) {
  if (Math.random() < negBias && min < 0n) {
    return randBigInt(min, -1n);
  }
  return randBigInt(0n, max);
}

function pickRepr(settings) {
  if (settings.rep === 'both') return Math.random() < 0.5 ? 'ones' : 'twos';
  return settings.rep;
}

function boundaryValue(repr, width) {
  const opts = repr === 'twos'
    ? [twosMin(width), -1n, 0n, twosMax(width)]
    : [onesMin(width), -1n, 0n, onesMax(width)];
  return opts[Math.floor(Math.random() * opts.length)];
}

function generateOne(settings) {
  const width = +settings.width;
  const format = settings.format;
  let directions = settings.directions.filter(d => d !== 'convert' || settings.rep === 'both');
  if (!directions.length) directions = ['toBits', 'toDec'];
  const direction = directions[Math.floor(Math.random() * directions.length)];

  if (direction === 'convert') {
    const fromRepr = Math.random() < 0.5 ? 'ones' : 'twos';
    const toRepr = fromRepr === 'ones' ? 'twos' : 'ones';
    const min = onesMin(width), max = onesMax(width);
    let value = Math.random() < 0.15 ? boundaryValue('ones', width) : randomSigned(min, max, 2 / 3);
    let fromBits = encode(value, fromRepr, width);
    if (fromRepr === 'ones' && Math.random() < 0.08) fromBits = '1'.repeat(width); // negative zero
    const decoded = decode(fromBits, fromRepr, width);
    const toBits = encode(decoded, toRepr, width);
    return { repr: null, width, format, direction, fromRepr, toRepr, fromBits, toBits, value: decoded };
  }

  const repr = pickRepr(settings);
  const min = repr === 'twos' ? twosMin(width) : onesMin(width);
  const max = repr === 'twos' ? twosMax(width) : onesMax(width);

  if (direction === 'toDec') {
    let bits;
    if (repr === 'ones' && Math.random() < 0.1) {
      bits = '1'.repeat(width); // negative zero, a named special case
    } else {
      const value = Math.random() < 0.15 ? boundaryValue(repr, width) : randomSigned(min, max, 2 / 3);
      bits = encode(value, repr, width);
    }
    const value = decode(bits, repr, width);
    return { repr, width, format, direction, bits, value, negZero: repr === 'ones' && bits === '1'.repeat(width) };
  }

  // toBits
  const value = Math.random() < 0.15 ? boundaryValue(repr, width) : randomSigned(min, max, 2 / 3);
  const bits = encode(value, repr, width);
  return { repr, width, format, direction, value, bits };
}

function fullWidthDigits(format, width) { return format === 'hex' ? width / 4 : width; }

function checkPattern(input, correctBits, width, format) {
  const prefix = format === 'hex' ? '0x' : '0b';
  let s = normalizeInput(input, prefix);
  if (!s) return { status: 'empty', message: '' };
  const re = format === 'hex' ? /^[0-9a-f]+$/ : /^[01]+$/;
  if (!re.test(s)) return { status: 'invalid', message: `That isn't a valid ${format === 'hex' ? 'hex' : 'binary'} pattern.` };
  const expected = format === 'hex' ? toHex(correctBits, width).toLowerCase() : correctBits;
  const expectedLen = fullWidthDigits(format, width);
  if (s.length < expectedLen) {
    if (s.padStart(expectedLen, '0') === expected) {
      return { status: 'wrong', message: `Write all ${width} bits.` };
    }
  }
  if (s.padStart(expectedLen, '0') === expected && s.length <= expectedLen) {
    return { status: 'correct', message: 'Correct' };
  }
  const shown = format === 'hex' ? expected.toUpperCase() : groupBitsDisplay(correctBits);
  return { status: 'wrong', message: `Not quite. Answer: <span class="mono">${shown}</span>` };
}

function checkDecimal(input, correctValue, negZero) {
  const s = normalizeInput(input);
  if (!s) return { status: 'empty', message: '' };
  if (!/^-?[0-9]+$/.test(s)) return { status: 'invalid', message: "That isn't a valid signed decimal number." };
  let v = BigInt(s);
  if (v === 0n) v = 0n; // normalize -0n to 0n implicitly via BigInt parsing
  const ok = v === correctValue || (negZero && (s === '0' || s === '-0'));
  if (ok) return { status: 'correct', message: 'Correct' };
  return { status: 'wrong', message: `Not quite. Answer: <span class="mono">${correctValue.toString()}</span>` };
}

function workToBits(p) {
  const { value, repr, width } = p;
  const L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  if (value >= 0n) {
    const bin = value.toString(2).padStart(width, '0');
    note('Positive values are just the binary value, padded to the full width.');
    line(`${value} in binary, padded to ${width} bits: <span class="res">${groupBitsDisplay(bin)}</span>`);
    return L.join('');
  }
  const mag = -value;
  const magBits = mag.toString(2).padStart(width, '0');
  line(`Magnitude: |${value}| = ${mag} = ${groupBitsDisplay(magBits)}`);
  if (repr === 'ones') {
    note("Negative in one's complement: write the magnitude, then invert every bit.");
    const inv = invertBits(magBits);
    line(`Invert every bit: <span class="res">${groupBitsDisplay(inv)}</span>`);
  } else {
    note("Negative in two's complement: write the magnitude, invert every bit, then add 1.");
    const inv = invertBits(magBits);
    line(`Invert every bit: ${groupBitsDisplay(inv)}`);
    const withCarry = (BigInt('0b' + inv) + 1n) & ((1n << BigInt(width)) - 1n);
    const result = withCarry.toString(2).padStart(width, '0');
    line(`Add 1, showing the carry: ${inv} + 1 = <span class="res">${groupBitsDisplay(result)}</span>`);
  }
  return L.join('');
}

function workToDec(p) {
  const { bits, repr, width, negZero } = p;
  const L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  line(`Bit pattern: ${groupBitsDisplay(bits)}`);
  if (negZero) {
    note("All ones in one's complement is negative zero. It decodes to 0 (written -0).");
    line('<span class="res">Result: -0, which equals 0</span>');
    return L.join('');
  }
  if (bits[0] === '0') {
    note('The most significant bit is 0, so this is a positive value. Read it as plain binary.');
    line(`<span class="res">Result: ${decode(bits, repr, width)}</span>`);
    return L.join('');
  }
  note('The most significant bit is 1, so this is negative. Undo the representation to find the magnitude.');
  if (repr === 'ones') {
    const inv = invertBits(bits);
    line(`Invert every bit: ${inv} = ${BigInt('0b' + inv)}`);
    line(`<span class="res">Result: -${BigInt('0b' + inv)}</span>`);
  } else {
    const inv = invertBits(bits);
    const mag = BigInt('0b' + inv) + 1n;
    line(`Invert every bit: ${inv}`);
    line(`Add 1: ${mag}`);
    line(`<span class="res">Result: -${mag}</span>`);
    note('Shortcut: the most significant bit is worth -2^(n-1). Add up the place values with that one bit negative.');
    const places = bits.split('').map((c, i) => {
      const power = width - 1 - i;
      const val = i === 0 ? -(2n ** BigInt(power)) : (c === '1' ? 2n ** BigInt(power) : 0n);
      return { c, power, val };
    }).filter(x => x.c === '1');
    line(places.map(x => `${x.val}`).join(' + ').replace('+ -', '- ') + ` = ${decode(bits, repr, width)}`);
  }
  return L.join('');
}

function workConvert(p) {
  const { fromBits, toBits, fromRepr, toRepr, width, value } = p;
  const L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  note(`Decode the ${REPR_NAME[fromRepr]} pattern to find the value, then re-encode it in ${REPR_NAME[toRepr]}.`);
  line(`${groupBitsDisplay(fromBits)} in ${REPR_NAME[fromRepr]} = ${value}`);
  L.push(workToBits({ value, repr: toRepr, width }));
  line(`<span class="res">Result: ${groupBitsDisplay(toBits)}</span>`);
  return L.join('');
}

export default {
  id: 'signed',
  label: 'Signed integers',

  defaults: { rep: 'both', width: '8', directions: ['toBits', 'toDec'], format: 'bin' },

  renderOptions(settings) {
    const s = { ...this.defaults, ...settings };
    const radio = (name, v, cur, label) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}> ${label}</label>`;
    const check = (name, v, arr, label) => `<label><input type="checkbox" name="${name}" value="${v}" ${arr.includes(v) ? 'checked' : ''}> ${label}</label>`;
    const opt = (v, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v}-bit</option>`;
    return `
      <fieldset>
        <legend>Representation</legend>
        <div class="checks">
          ${radio('rep', 'ones', s.rep, "One's complement")}
          ${radio('rep', 'twos', s.rep, "Two's complement")}
          ${radio('rep', 'both', s.rep, 'Both, mixed')}
        </div>
      </fieldset>
      <div>
        <label class="lbl" for="width">Width</label>
        <select id="width" name="width">${WIDTHS.map(w => opt(String(w), s.width)).join('')}</select>
      </div>
      <fieldset>
        <legend>Directions</legend>
        <div class="checks">
          ${check('directions', 'toBits', s.directions, 'Decimal to bit pattern')}
          ${check('directions', 'toDec', s.directions, 'Bit pattern to decimal')}
          ${s.rep === 'both' ? check('directions', 'convert', s.directions, 'Convert between representations') : ''}
        </div>
      </fieldset>
      <fieldset>
        <legend>Bit-pattern format</legend>
        <div class="checks">
          ${radio('format', 'bin', s.format, 'Binary')}
          ${radio('format', 'hex', s.format, 'Hex')}
        </div>
      </fieldset>`;
  },

  readOptions(root) {
    const rep = root.querySelector('input[name=rep]:checked')?.value ?? this.defaults.rep;
    const width = root.querySelector('#width')?.value ?? this.defaults.width;
    const directions = [...root.querySelectorAll('input[name=directions]:checked')].map(i => i.value);
    const format = root.querySelector('input[name=format]:checked')?.value ?? this.defaults.format;
    return {
      rep: REPRS.includes(rep) ? rep : this.defaults.rep,
      width: WIDTHS.includes(+width) ? width : this.defaults.width,
      directions: directions.length ? directions : this.defaults.directions,
      format: FORMATS.includes(format) ? format : this.defaults.format,
    };
  },

  settingsFromParams(params, current) {
    const s = { ...current };
    if (params.has('rep') && REPRS.includes(params.get('rep'))) s.rep = params.get('rep');
    if (params.has('width') && WIDTHS.includes(+params.get('width'))) s.width = params.get('width');
    if (params.has('directions')) {
      const d = params.get('directions').split(',').map(v => v.trim()).filter(v => DIRECTIONS.includes(v));
      if (d.length) s.directions = d;
    }
    if (params.has('format') && FORMATS.includes(params.get('format'))) s.format = params.get('format');
    return s;
  },

  generate(settings, count) {
    const seen = new Set();
    const problems = [];
    let guard = 0;
    while (problems.length < count && guard < 20000) {
      guard++;
      const p = generateOne(settings);
      const k = JSON.stringify([p.direction, p.repr, p.fromRepr, p.width, p.value?.toString(), p.bits, p.fromBits]);
      if (seen.has(k)) continue;
      seen.add(k);
      problems.push(p);
    }
    return problems;
  },

  prompt(p) {
    if (p.direction === 'convert') {
      return {
        valueHtml: `<span class="mono">${displayBits(p.fromBits, p.width, p.format)}</span>`,
        directionText: `${REPR_NAME[p.fromRepr]} to ${REPR_NAME[p.toRepr]} (${p.width}-bit)`,
        answerLabel: `answer as ${p.width}-bit ${p.format === 'hex' ? 'hex' : 'binary'}`,
        inputmode: 'text',
      };
    }
    if (p.direction === 'toBits') {
      return {
        valueHtml: `${p.value}<sub>10</sub>`,
        directionText: `${REPR_NAME[p.repr]}, ${p.width}-bit: decimal to bit pattern`,
        answerLabel: `answer as ${p.width}-bit ${p.format === 'hex' ? 'hex' : 'binary'}`,
        inputmode: 'text',
      };
    }
    return {
      valueHtml: `<span class="mono">${displayBits(p.bits, p.width, p.format)}</span>`,
      directionText: `${REPR_NAME[p.repr]}, ${p.width}-bit: bit pattern to decimal`,
      answerLabel: 'answer in decimal',
      inputmode: 'text',
    };
  },

  check(p, input) {
    if (p.direction === 'toDec') return checkDecimal(input, p.value, p.negZero);
    if (p.direction === 'toBits') return checkPattern(input, p.bits, p.width, p.format);
    return checkPattern(input, p.toBits, p.width, p.format);
  },

  answer(p) {
    if (p.direction === 'toDec') return p.negZero ? '-0' : p.value.toString();
    if (p.direction === 'toBits') return displayBits(p.bits, p.width, p.format);
    return displayBits(p.toBits, p.width, p.format);
  },

  work(p) {
    if (p.direction === 'toBits') return workToBits(p);
    if (p.direction === 'toDec') return workToDec(p);
    return workConvert(p);
  },

  statKey(p) {
    if (p.direction === 'convert') return `conv${p.width}:${p.fromRepr}-${p.toRepr}`;
    const pair = p.direction === 'toBits' ? 'dec-bin' : 'bin-dec';
    return `${p.repr}${p.width}:${pair}`;
  },

  statLabel(key) {
    let m = key.match(/^(ones|twos)(8|16|32|64):(dec-bin|bin-dec)$/);
    if (m) {
      const dir = m[3] === 'dec-bin' ? 'decimal to bits' : 'bits to decimal';
      return `${REPR_NAME[m[1]]}, ${m[2]}-bit, ${dir}`;
    }
    m = key.match(/^conv(8|16|32|64):(ones|twos)-(ones|twos)$/);
    if (m) return `Convert ${m[2]} to ${m[3]} complement (${m[1]}-bit)`;
    return null;
  },

  lessonAnchor(p) {
    if (p.direction === 'convert') return 'lesson-8';
    return p.repr === 'ones' ? 'lesson-7' : 'lesson-8';
  },

  // Build a fully-formed problem from fixed values, for lesson pages that
  // need the exact same work()/prompt()/answer() output as practice mode.
  example({ repr, width, direction, value, fromRepr, toRepr, format = 'bin' }) {
    if (direction === 'convert') {
      const v = BigInt(value);
      const fromBits = encode(v, fromRepr, width);
      const toBits = encode(v, toRepr, width);
      return { repr: null, width, format, direction, fromRepr, toRepr, fromBits, toBits, value: v };
    }
    if (direction === 'toDec') {
      const bits = encode(BigInt(value), repr, width);
      return { repr, width, format, direction, bits, value: decode(bits, repr, width), negZero: false };
    }
    const v = BigInt(value);
    return { repr, width, format, direction, value: v, bits: encode(v, repr, width) };
  },
};
