'use strict';

// IEEE 754 floating point mode: single (32-bit) and double (64-bit)
// precision. DataView / ArrayBuffer is the source of truth for every bit
// pattern; BigInt holds all 32/64-bit values.

import { cleanInput, normalizeInput, randInt, randBigInt } from '../format.js';

const PREC = {
  single: { width: 32, expBits: 8, fracBits: 23, bias: 127, hexDigits: 8 },
  double: { width: 64, expBits: 11, fracBits: 52, bias: 1023, hexDigits: 16 },
};
const PRECISION_NAME = { single: 'Single precision', double: 'Double precision' };
const PRECISIONS = ['single', 'double', 'both'];
const DIRECTIONS = ['toBits', 'toDec'];

function bitsFromValue(value, precision) {
  if (precision === 'single') {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setFloat32(0, value, false);
    return BigInt(dv.getUint32(0, false));
  }
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, value, false);
  return dv.getBigUint64(0, false);
}
function valueFromBits(bits, precision) {
  if (precision === 'single') {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, Number(bits), false);
    return dv.getFloat32(0, false);
  }
  const dv = new DataView(new ArrayBuffer(8));
  dv.setBigUint64(0, bits, false);
  return dv.getFloat64(0, false);
}
function fields(bits, precision) {
  const info = PREC[precision];
  const sign = (bits >> BigInt(info.width - 1)) & 1n;
  const exp = (bits >> BigInt(info.fracBits)) & ((1n << BigInt(info.expBits)) - 1n);
  const frac = bits & ((1n << BigInt(info.fracBits)) - 1n);
  return { sign, exp, frac };
}
function toHex(bits, hexDigits) { return bits.toString(16).toUpperCase().padStart(hexDigits, '0'); }

function isValidNaNBits(bits, precision) {
  const info = PREC[precision];
  const { exp, frac } = fields(bits, precision);
  return exp === ((1n << BigInt(info.expBits)) - 1n) && frac !== 0n;
}

function randomNormalValue() {
  const e = randInt(-8, 15);
  const L = randInt(1, 10);
  const sig = randBigInt(1n << BigInt(L - 1), (1n << BigInt(L)) - 1n);
  const shift = e - (L - 1);
  const magnitude = Number(sig) * Math.pow(2, shift);
  return Math.random() < 0.5 ? -magnitude : magnitude;
}

function buildSpecial(kind, precision) {
  const info = PREC[precision];
  const expAll1 = (1n << BigInt(info.expBits)) - 1n;
  const signBit = 1n << BigInt(info.width - 1);
  if (kind === 'zero+') return { bits: 0n, value: 0, kind: 'zero' };
  if (kind === 'zero-') return { bits: signBit, value: -0, kind: 'zero' };
  if (kind === 'inf+') return { bits: expAll1 << BigInt(info.fracBits), value: Infinity, kind: 'inf' };
  if (kind === 'inf-') return { bits: signBit | (expAll1 << BigInt(info.fracBits)), value: -Infinity, kind: 'inf' };
  if (kind === 'nan') {
    const fracMsb = 1n << BigInt(info.fracBits - 1);
    return { bits: (expAll1 << BigInt(info.fracBits)) | fracMsb, value: NaN, kind: 'nan' };
  }
  // subnormal
  const L = randInt(1, Math.min(10, info.fracBits));
  const fracVal = randBigInt(1n, (1n << BigInt(L)) - 1n);
  const bits = (kind === 'sub-' ? signBit : 0n) | fracVal;
  return { bits, value: valueFromBits(bits, precision), kind: 'subnormal' };
}

function pickPrecision(settings) {
  if (settings.precision === 'both') return Math.random() < 0.5 ? 'single' : 'double';
  return settings.precision;
}

function generateOne(settings) {
  const precision = pickPrecision(settings);
  const direction = settings.directions[randInt(0, settings.directions.length - 1)];
  const inputStyle = (settings.splitInput && precision === 'single') ? 'split' : 'hex';

  if (settings.includeSpecials && Math.random() < 0.25) {
    const kinds = ['zero+', 'zero-', 'inf+', 'inf-', 'nan', 'sub+', 'sub-'];
    const { bits, value, kind } = buildSpecial(kinds[randInt(0, kinds.length - 1)], precision);
    return { precision, direction, inputStyle, bits, value, kind };
  }

  const value = randomNormalValue();
  const bits = bitsFromValue(value, precision);
  if (valueFromBits(bits, precision) !== value) return generateOne(settings); // defensive; construction is always exact
  return { precision, direction, inputStyle, bits, value, kind: 'normal' };
}

/* ---------- display ---------- */

function decimalDisplay(p) {
  if (p.kind === 'zero') return Object.is(p.value, -0) ? '-0' : '0';
  if (p.kind === 'inf') return p.value > 0 ? 'Infinity' : '-Infinity';
  if (p.kind === 'nan') return 'NaN';
  return p.value.toString();
}

function bitsDisplaySplit(bits, precision) {
  const info = PREC[precision];
  const { sign, exp, frac } = fields(bits, precision);
  const expBin = exp.toString(2).padStart(info.expBits, '0');
  const fracBin = frac.toString(2).padStart(info.fracBits, '0');
  return `<span class="fields mono"><span class="field">${sign}</span> <span class="field">${expBin}</span> <span class="field">${fracBin}</span></span>`;
}

function bitsDisplay(p) {
  return p.inputStyle === 'split' ? bitsDisplaySplit(p.bits, p.precision) : `<span class="mono">${toHex(p.bits, PREC[p.precision].hexDigits)}</span>`;
}

function correctAnswerDisplay(p) {
  if (p.direction === 'toDec') return decimalDisplay(p);
  return p.inputStyle === 'split' ? bitsDisplaySplit(p.bits, p.precision) : toHex(p.bits, PREC[p.precision].hexDigits);
}

/* ---------- checking ---------- */

function checkDecimalAnswer(input, p) {
  const raw = cleanInput(input);
  if (!raw) return { status: 'empty', message: '' };
  const lower = raw.toLowerCase();
  const infWords = new Set(['inf', 'infinity', '+inf', '+infinity']);
  const negInfWords = new Set(['-inf', '-infinity']);

  if (p.kind === 'nan') {
    return lower === 'nan'
      ? { status: 'correct', message: 'Correct' }
      : { status: 'wrong', message: 'Not quite. Answer: <span class="mono">NaN</span>' };
  }
  if (p.kind === 'inf') {
    const positive = p.value > 0;
    const ok = positive ? infWords.has(lower) : negInfWords.has(lower);
    return ok
      ? { status: 'correct', message: 'Correct' }
      : { status: 'wrong', message: `Not quite. Answer: <span class="mono">${positive ? 'Infinity' : '-Infinity'}</span>` };
  }
  if (lower === 'nan' || infWords.has(lower) || negInfWords.has(lower)) {
    return { status: 'invalid', message: 'This value is finite, not infinite or NaN.' };
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(lower)) {
    return { status: 'invalid', message: "That isn't a valid decimal number." };
  }
  const v = Number(raw);
  const correct = p.kind === 'zero' ? Object.is(v, p.value) : v === p.value;
  return correct
    ? { status: 'correct', message: 'Correct' }
    : { status: 'wrong', message: `Not quite. Answer: <span class="mono">${decimalDisplay(p)}</span>` };
}

function checkBitsAnswer(input, p) {
  const info = PREC[p.precision];
  const hex = p.inputStyle !== 'split';
  const prefix = hex ? '0x' : '0b';
  const s = normalizeInput(input, prefix);
  if (!s) return { status: 'empty', message: '' };
  const re = hex ? /^[0-9a-f]+$/ : /^[01]+$/;
  if (!re.test(s)) return { status: 'invalid', message: `That isn't a valid ${hex ? 'hex' : 'binary'} pattern.` };

  const digitsExpected = hex ? info.hexDigits : info.width;
  const answerText = correctAnswerDisplay(p);
  const wrong = () => ({ status: 'wrong', message: `Not quite. Answer: <span class="mono">${typeof answerText === 'string' ? answerText : ''}</span>` });

  if (p.kind === 'nan') {
    if (s.length > digitsExpected) return wrong();
    const padded = s.padStart(digitsExpected, '0');
    const candidateBits = hex ? BigInt('0x' + padded) : BigInt('0b' + padded);
    if (!isValidNaNBits(candidateBits, p.precision)) return wrong();
    if (s.length < digitsExpected) return { status: 'wrong', message: `Write all ${digitsExpected} ${hex ? 'hex digits' : 'bits'}.` };
    return { status: 'correct', message: 'Correct' };
  }

  const expected = hex ? toHex(p.bits, info.hexDigits).toLowerCase() : p.bits.toString(2).padStart(info.width, '0');
  if (s.length < digitsExpected) {
    if (s.padStart(digitsExpected, '0') === expected) {
      return { status: 'wrong', message: `Write all ${digitsExpected} ${hex ? 'hex digits' : 'bits'}.` };
    }
  }
  if (s.length <= digitsExpected && s.padStart(digitsExpected, '0') === expected) {
    return { status: 'correct', message: 'Correct' };
  }
  return wrong();
}

/* ---------- worked solutions ---------- */

function workToBitsNormal(p) {
  const info = PREC[p.precision];
  const L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  const value = p.value;
  const sign = value < 0 ? 1 : 0;
  const mag = Math.abs(value);

  line(`Sign: ${value} is ${sign ? 'negative' : 'positive'}, so the sign bit is ${sign}.`);

  const intPart = Math.floor(mag);
  const intBin = intPart === 0 ? '0' : intPart.toString(2);
  note('Convert the integer part to binary.');
  line(`Integer part ${intPart} = ${intBin}`);

  note('Convert the fraction by doubling it repeatedly. When the result reaches 1 or more, record a 1 and drop the 1; otherwise record a 0.');
  let frac = mag - intPart;
  const fracBitsArr = [];
  let guard = 0;
  while (frac > 0 && guard < 60) {
    const doubled = frac * 2;
    if (doubled >= 1) { fracBitsArr.push('1'); line(`${frac} &times; 2 = ${doubled} &rarr; 1, remainder ${doubled - 1}`); frac = doubled - 1; }
    else { fracBitsArr.push('0'); line(`${frac} &times; 2 = ${doubled} &rarr; 0`); frac = doubled; }
    guard++;
  }
  const fracBin = fracBitsArr.join('');
  line(`Fraction bits: 0.${fracBin || '0'}`);

  note('Normalize to 1.xxxx &times; 2^e.');
  let e, mantissaBits;
  if (intPart > 0) {
    e = intBin.length - 1;
    mantissaBits = intBin.slice(1) + fracBin;
  } else {
    const firstOne = fracBin.indexOf('1');
    e = -(firstOne + 1);
    mantissaBits = fracBin.slice(firstOne + 1);
  }
  line(`Normalized: 1.${mantissaBits || '0'} &times; 2<sup>${e}</sup>`);

  const biasedExp = e + info.bias;
  note(`Biased exponent: ${e} + ${info.bias} = ${biasedExp}, shown in binary.`);
  const expBin = biasedExp.toString(2).padStart(info.expBits, '0');
  line(`Exponent bits: ${expBin}`);

  note(`Fraction bits: drop the leading 1 and pad to ${info.fracBits} bits.`);
  const fracField = mantissaBits.padEnd(info.fracBits, '0').slice(0, info.fracBits);
  line(`Fraction field: ${fracField}`);

  note('Assemble the fields.');
  line(`sign | exponent | fraction = ${sign} | ${expBin} | ${fracField}`);

  const bits = BigInt('0b' + sign + expBin + fracField);
  note('Group into hex.');
  line(`<span class="res">Hex: ${toHex(bits, info.hexDigits)}</span>`);
  return L.join('');
}

function workToDecNormal(p) {
  const info = PREC[p.precision];
  const L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  const { sign, exp, frac } = fields(p.bits, p.precision);
  const expBin = exp.toString(2).padStart(info.expBits, '0');
  const fracBin = frac.toString(2).padStart(info.fracBits, '0');

  note('Split the fields.');
  line(`sign | exponent | fraction = ${sign} | ${expBin} | ${fracBin}`);
  note('Read the sign.');
  line(`Sign bit ${sign} means the value is ${sign ? 'negative' : 'positive'}.`);
  note('Subtract the bias to find the unbiased exponent.');
  const e = Number(exp) - info.bias;
  line(`${exp} - ${info.bias} = ${e}`);
  note('Rebuild 1.fraction.');
  line(`1.${fracBin}`);
  note(`Shift by the exponent and convert to decimal: 1.${fracBin} (base 2) &times; 2<sup>${e}</sup>.`);
  line(`<span class="res">Result: ${p.value.toString()}</span>`);
  return L.join('');
}

function workSpecial(p) {
  const info = PREC[p.precision];
  const L = [];
  const note = s => L.push(`<p class="note">${s}</p>`);
  const line = s => L.push(`<p>${s}</p>`);
  if (p.kind === 'zero') {
    note('Zero is all bits 0. The sign bit alone tells +0 from -0; exponent and fraction are both all zero either way.');
    line(`<span class="res">${decimalDisplay(p)}: ${toHex(p.bits, info.hexDigits)}</span>`);
  } else if (p.kind === 'inf') {
    note('Infinity has an exponent of all 1s and a fraction of all 0s. The sign bit shows the direction.');
    line(`<span class="res">${decimalDisplay(p)}: ${toHex(p.bits, info.hexDigits)}</span>`);
  } else if (p.kind === 'nan') {
    note('NaN has an exponent of all 1s and a nonzero fraction. Any nonzero fraction is a valid NaN; this is the canonical quiet NaN.');
    line(`<span class="res">NaN: ${toHex(p.bits, info.hexDigits)}</span>`);
  } else {
    note(`Subnormals use the minimum exponent (${1 - info.bias}) with no implicit leading 1, so the value is just the fraction bits, shifted all the way down.`);
    line(`Fraction: ${fields(p.bits, p.precision).frac.toString(2).padStart(info.fracBits, '0')}`);
    line(`<span class="res">Result: ${p.value.toString()}</span>`);
  }
  return L.join('');
}

/* ---------- mode object ---------- */

export default {
  id: 'float',
  label: 'Floating point',

  defaults: { precision: 'both', directions: ['toBits', 'toDec'], splitInput: false, includeSpecials: false },

  renderOptions(settings) {
    const s = { ...this.defaults, ...settings };
    const radio = (name, v, cur, label) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}> ${label}</label>`;
    const check = (name, v, arr, label) => `<label><input type="checkbox" name="${name}" value="${v}" ${arr.includes(v) ? 'checked' : ''}> ${label}</label>`;
    const single = (name, cur, label) => `<label><input type="checkbox" name="${name}" ${cur ? 'checked' : ''}> ${label}</label>`;
    return `
      <fieldset>
        <legend>Precision</legend>
        <div class="checks">
          ${radio('precision', 'single', s.precision, 'Single (32-bit)')}
          ${radio('precision', 'double', s.precision, 'Double (64-bit)')}
          ${radio('precision', 'both', s.precision, 'Both, mixed')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Directions</legend>
        <div class="checks">
          ${check('directions', 'toBits', s.directions, 'Decimal to bit pattern')}
          ${check('directions', 'toDec', s.directions, 'Bit pattern to decimal')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Extra options</legend>
        <div class="checks">
          ${single('splitInput', s.splitInput, 'Split input for single precision (sign, exponent, fraction)')}
          ${single('includeSpecials', s.includeSpecials, 'Include special values (zero, infinity, NaN, subnormals)')}
        </div>
      </fieldset>`;
  },

  readOptions(root) {
    const precision = root.querySelector('input[name=precision]:checked')?.value ?? this.defaults.precision;
    const directions = [...root.querySelectorAll('input[name=directions]:checked')].map(i => i.value);
    const splitInput = !!root.querySelector('input[name=splitInput]')?.checked;
    const includeSpecials = !!root.querySelector('input[name=includeSpecials]')?.checked;
    return {
      precision: PRECISIONS.includes(precision) ? precision : this.defaults.precision,
      directions: directions.length ? directions : this.defaults.directions,
      splitInput,
      includeSpecials,
    };
  },

  settingsFromParams(params, current) {
    const s = { ...current };
    if (params.has('precision')) {
      const raw = params.get('precision');
      const map = { '32': 'single', '64': 'double', single: 'single', double: 'double', both: 'both' };
      if (map[raw]) s.precision = map[raw];
    }
    if (params.has('directions')) {
      const d = params.get('directions').split(',').map(v => v.trim()).filter(v => DIRECTIONS.includes(v));
      if (d.length) s.directions = d;
    }
    if (params.has('split')) s.splitInput = ['1', 'true', 'yes'].includes(params.get('split').toLowerCase());
    if (params.has('specials')) s.includeSpecials = ['1', 'true', 'yes'].includes(params.get('specials').toLowerCase());
    return s;
  },

  generate(settings, count) {
    const problems = [];
    const seen = new Set();
    let guard = 0;
    while (problems.length < count && guard < 20000) {
      guard++;
      const p = generateOne(settings);
      const k = `${p.precision}|${p.direction}|${p.bits.toString()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      problems.push(p);
    }
    return problems;
  },

  prompt(p) {
    const info = PREC[p.precision];
    if (p.direction === 'toBits') {
      return {
        valueHtml: `${decimalDisplay(p)}<sub>10</sub>`,
        directionText: `${PRECISION_NAME[p.precision]}: decimal to bit pattern`,
        answerLabel: p.inputStyle === 'split' ? 'answer as sign, exponent, fraction' : `answer as ${info.hexDigits}-digit hex`,
        inputmode: 'text',
        fields: p.inputStyle === 'split' ? [
          { label: 'sign (1 bit)', width: 1 },
          { label: 'exponent (8 bits)', width: 8 },
          { label: 'fraction (23 bits)', width: 23 },
        ] : null,
      };
    }
    return {
      valueHtml: bitsDisplay(p),
      directionText: `${PRECISION_NAME[p.precision]}: bit pattern to decimal`,
      answerLabel: 'answer in decimal',
      inputmode: 'text',
    };
  },

  check(p, input) {
    return p.direction === 'toDec' ? checkDecimalAnswer(input, p) : checkBitsAnswer(input, p);
  },

  answer(p) { return correctAnswerDisplay(p); },

  work(p) {
    if (p.kind !== 'normal') return workSpecial(p);
    return p.direction === 'toBits' ? workToBitsNormal(p) : workToDecNormal(p);
  },

  statKey(p) {
    const prec = p.precision === 'single' ? 'f32' : 'f64';
    const pair = p.direction === 'toBits' ? 'dec-bin' : 'bin-dec';
    return `${prec}:${pair}`;
  },

  statLabel(key) {
    const m = key.match(/^(f32|f64):(dec-bin|bin-dec)$/);
    if (!m) return null;
    const name = m[1] === 'f32' ? 'single precision' : 'double precision';
    const dir = m[2] === 'dec-bin' ? 'decimal to bits' : 'bits to decimal';
    return `${name}, ${dir}`;
  },

  lessonAnchor(p) {
    if (p.kind !== 'normal') return 'lesson-13';
    if (p.precision === 'double') return 'lesson-12';
    return p.direction === 'toBits' ? 'lesson-10' : 'lesson-11';
  },

  // Build a fully-formed problem from a fixed decimal value, for lesson
  // pages that need the exact same work()/prompt()/answer() output as
  // practice mode.
  example({ precision, direction, value }) {
    const bits = bitsFromValue(value, precision);
    return { precision, direction, inputStyle: 'hex', bits, value, kind: 'normal' };
  },

  // kind: 'zero+' | 'zero-' | 'inf+' | 'inf-' | 'nan' | 'sub+' | 'sub-'
  exampleSpecial({ precision, kind, direction = 'toDec' }) {
    const built = buildSpecial(kind, precision);
    return { precision, direction, inputStyle: 'hex', ...built };
  },
};
