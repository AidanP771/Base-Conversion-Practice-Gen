import { groupBits, normalizeInput, escapeHtml } from '../format.js';

const SPECS = { 32: { bytes: 4, exponent: 8, fraction: 23, bias: 127 }, 64: { bytes: 8, exponent: 11, fraction: 52, bias: 1023 } };
const SPECIAL_BITS = { 32: ['00000000', '80000000', '7F800000', 'FF800000', '7FC00000'], 64: ['0000000000000000', '8000000000000000', '7FF0000000000000', 'FFF0000000000000', '7FF8000000000000'] };

export const float = {
  id: 'float', label: 'Floating point',
  defaults: { precision: 'both', direction: 'both', format: 'hex', split: false, special: false, count: '20' },
  renderOptions(settings) {
    return `<div><label class="lbl" for="precision">Precision</label><select id="precision"><option value="32" ${settings.precision === '32' ? 'selected' : ''}>Single (32-bit)</option><option value="64" ${settings.precision === '64' ? 'selected' : ''}>Double (64-bit)</option><option value="both" ${settings.precision === 'both' ? 'selected' : ''}>Both mixed</option></select></div><div><label class="lbl" for="direction">Directions</label><select id="direction"><option value="both" ${settings.direction === 'both' ? 'selected' : ''}>Both directions</option><option value="encode" ${settings.direction === 'encode' ? 'selected' : ''}>Decimal to bits</option><option value="decode" ${settings.direction === 'decode' ? 'selected' : ''}>Bits to decimal</option></select></div><div><label class="lbl" for="format">Bit-pattern format</label><select id="format"><option value="hex" ${settings.format === 'hex' ? 'selected' : ''}>Hex (default)</option><option value="bin" ${settings.format === 'bin' ? 'selected' : ''}>Binary</option></select></div><label><input type="checkbox" id="split" ${settings.split ? 'checked' : ''}> Split single input</label><label><input type="checkbox" id="special" ${settings.special ? 'checked' : ''}> Include special values</label><div><label class="lbl" for="count">Problems</label><select id="count">${[10, 20, 30, 40].map(n => `<option ${String(n) === String(settings.count) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  },
  readOptions(root) { return { precision: root.querySelector('#precision').value, direction: root.querySelector('#direction').value, format: root.querySelector('#format').value, split: root.querySelector('#split').checked, special: root.querySelector('#special').checked, count: root.querySelector('#count').value }; },
  generate(settings, count = Number(settings.count)) {
    const precisions = settings.precision === 'both' ? [32, 64] : [Number(settings.precision)];
    const directions = settings.direction === 'both' ? ['encode', 'decode'] : [settings.direction];
    const problems = [];
    for (let index = 0; index < count; index++) {
      const precision = precisions[index % precisions.length], direction = directions[index % directions.length];
      const value = settings.special && index % 7 === 0 ? [0, -0, Infinity, -Infinity, NaN][Math.floor(index / 7) % 5] : randomExact(precision);
      const pattern = bitsOf(value, precision);
      const actual = fromBits(pattern, precision);
      if (!Number.isNaN(value) && Object.is(actual, value) === false) { index--; continue; }
      problems.push({ precision, direction, format: settings.format, split: settings.split, value: direction === 'decode' ? pattern : value, pattern, graded: false });
    }
    return problems;
  },
  prompt(problem) { const decimal = problem.direction === 'encode'; return { valueHtml: decimal ? `<span class="mono">${escapeHtml(displayDecimal(problem.value))}</span>` : `<span class="mono">${problem.format === 'hex' ? patternHex(problem.pattern, problem.precision) : groupBits(patternBits(problem.pattern, problem.precision))}</span>`, directionText: decimal ? `decimal to IEEE 754 ${problem.precision === 32 ? 'single' : 'double'} precision` : `IEEE 754 ${problem.precision === 32 ? 'single' : 'double'} precision to decimal`, answerLabel: decimal ? 'Bit pattern' : 'Decimal value', inputmode: 'text', fields: decimal && problem.split && problem.precision === 32 ? ['Sign', 'Exponent', 'Fraction'] : null }; },
  check(problem, input) {
    const text = String(input ?? '').trim(); if (!text) return { status: 'empty', message: '' };
    if (problem.direction === 'encode') { const parsed = parsePattern(text, problem.precision, problem.format, problem.split); if (parsed === null) return { status: 'invalid', message: 'Enter a valid full-width IEEE bit pattern.' }; const expected = patternHex(problem.pattern, problem.precision); const isNaNAnswer = Number.isNaN(problem.value) && isNaNBits(parsed, problem.precision); return isNaNAnswer || parsed.toUpperCase() === expected ? { status: 'correct', message: 'Correct' } : { status: 'wrong', message: `Not quite. Answer: ${expected}` }; }
    const answer = parseDecimal(text); if (answer === null) return { status: 'invalid', message: 'Enter a decimal value such as -13.625, NaN or infinity.' }; const expected = fromBits(problem.pattern, problem.precision); const correct = Number.isNaN(expected) ? Number.isNaN(answer) : Object.is(answer, expected) || answer === expected; return correct ? { status: 'correct', message: 'Correct' } : { status: 'wrong', message: `Not quite. Answer: ${displayDecimal(expected)}` };
  },
  answer(problem) { return problem.direction === 'encode' ? patternHex(problem.pattern, problem.precision) : displayDecimal(fromBits(problem.pattern, problem.precision)); },
  work(problem) { return floatWork(problem); },
  statKey: problem => `${problem.precision}:${problem.direction}`,
  statLabel: key => { const [precision, direction] = key.split(':'); return `${precision}-bit ${direction}`; }
};

function bitsOf(value, precision) { const buffer = new ArrayBuffer(SPECS[precision].bytes), view = new DataView(buffer); precision === 32 ? view.setFloat32(0, value, false) : view.setFloat64(0, value, false); return BigInt(`0x${[...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`); }
function fromBits(pattern, precision) { const buffer = new ArrayBuffer(SPECS[precision].bytes), bytes = pattern.toString(16).padStart(SPECS[precision].bytes * 2, '0').match(/../g).map(hex => parseInt(hex, 16)); new Uint8Array(buffer).set(bytes); const view = new DataView(buffer); return precision === 32 ? view.getFloat32(0, false) : view.getFloat64(0, false); }
function patternBits(pattern, precision) { return pattern.toString(2).padStart(precision, '0'); }
function patternHex(pattern, precision) { return pattern.toString(16).toUpperCase().padStart(precision / 4, '0'); }
function displayDecimal(value) { if (Number.isNaN(value)) return 'NaN'; if (value === Infinity) return 'Infinity'; if (value === -Infinity) return '-Infinity'; if (Object.is(value, -0)) return '-0'; return String(value); }
function parseDecimal(input) { const normalized = input.trim().toLowerCase(); if (normalized === 'nan') return NaN; if (['inf', '+inf', 'infinity', '+infinity'].includes(normalized)) return Infinity; if (['-inf', '-infinity'].includes(normalized)) return -Infinity; if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/.test(normalized)) return null; const value = Number(normalized); return Number.isFinite(value) ? value : null; }
function parsePattern(input, precision, format, split) { let text = String(input ?? '').trim().toLowerCase().replace(/[\s_]/g, ''); if (format === 'hex') text = text.replace(/^0x/, ''); const width = precision / 4; if (!split || precision !== 32) { if (!new RegExp(`^[0-9a-f]{${width}}$`).test(text)) return null; return text.toUpperCase(); } const fields = text.split('|').map(part => part.trim()); if (fields.length !== 3 || !/^[01]$/.test(fields[0]) || !/^\d{8}$/.test(fields[1]) || !/^\d{23}$/.test(fields[2])) return null; return BigInt(`0b${fields.join('')}`).toString(16).toUpperCase().padStart(8, '0'); }
function isNaNBits(hex, precision) { const value = BigInt(`0x${hex}`), spec = SPECS[precision]; const fractionMask = (1n << BigInt(spec.fraction)) - 1n; return ((value >> BigInt(spec.fraction)) & ((1n << BigInt(spec.exponent)) - 1n)) === (1n << BigInt(spec.exponent)) - 1n && (value & fractionMask) !== 0n; }
function randomExact(precision) { const significand = Math.floor(Math.random() * 1024) + 1, exponent = Math.floor(Math.random() * 24) - 8, sign = Math.random() < 0.5 ? -1 : 1; const value = sign * significand * 2 ** (exponent - 9); const pattern = bitsOf(value, precision); const roundTrip = fromBits(pattern, precision); return Object.is(roundTrip, value) ? value : roundExact(precision); }
function roundExact(precision) { const exponent = Math.floor(Math.random() * 16) - 8, value = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 64) + 1) * 2 ** exponent; return fromBits(bitsOf(value, precision), precision); }
function floatWork(problem) { const pattern = problem.pattern, precision = problem.precision, bits = patternBits(pattern, precision), spec = SPECS[precision], sign = bits[0], exponent = bits.slice(1, 1 + spec.exponent), fraction = bits.slice(1 + spec.exponent); return `<p class="note">IEEE 754 fields: sign | exponent | fraction.</p><p>${sign} | ${groupBits(exponent)} | ${groupBits(fraction)}</p><p>Exponent bits ${exponent} use bias ${spec.bias}; the fraction has ${spec.fraction} bits.</p><p class="res">Hex: ${patternHex(pattern, precision)}; value: ${displayDecimal(fromBits(pattern, precision))}</p>`; }

export { bitsOf, fromBits, patternBits, patternHex };
