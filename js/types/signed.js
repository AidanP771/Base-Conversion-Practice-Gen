import { groupBits, normalizeInput, padLeft, escapeHtml } from '../format.js';

const REPS = { ones: "ones' complement", twos: "two's complement" };
const WIDTHS = [8, 16, 32, 64];
const FORMATS = { bin: 'binary', hex: 'hex' };

export const signed = {
  id: 'signed', label: 'Signed integers',
  defaults: { rep: 'both', width: '8', format: 'bin', count: '20' },
  renderOptions(settings) {
    return `<div><label class="lbl" for="rep">Representation</label><select id="rep"><option value="ones" ${settings.rep === 'ones' ? 'selected' : ''}>Ones' complement</option><option value="twos" ${settings.rep === 'twos' ? 'selected' : ''}>Two's complement</option><option value="both" ${settings.rep === 'both' ? 'selected' : ''}>Both mixed</option></select></div><div><label class="lbl" for="width">Width</label><select id="width">${WIDTHS.map(width => `<option ${String(width) === String(settings.width) ? 'selected' : ''}>${width}</option>`).join('')}</select></div><div><label class="lbl" for="format">Bit-pattern format</label><select id="format"><option value="bin" ${settings.format === 'bin' ? 'selected' : ''}>Binary</option><option value="hex" ${settings.format === 'hex' ? 'selected' : ''}>Hex</option></select></div><div><label class="lbl" for="count">Problems</label><select id="count">${[10, 20, 30, 40].map(n => `<option ${String(n) === String(settings.count) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  },
  readOptions(root) { return { rep: root.querySelector('#rep').value, width: root.querySelector('#width').value, format: root.querySelector('#format').value, count: root.querySelector('#count').value }; },
  generate(settings, count = Number(settings.count)) {
    const width = Number(settings.width), reps = settings.rep === 'both' ? ['ones', 'twos'] : [settings.rep];
    const directions = ['encode', 'decode'];
    if (settings.rep === 'both') directions.push('convert');
    const problems = [];
    for (let index = 0; index < count; index++) {
      const rep = reps[index % reps.length], direction = directions[index % directions.length];
      let value = boundaryValue(rep, width, index);
      if (direction === 'decode') value = encode(value, rep, width);
      problems.push({ rep, width, format: settings.format, direction, value, graded: false });
    }
    return problems;
  },
  prompt(problem) {
    const valueHtml = problem.direction === 'encode' ? `${problem.value}<sub>10</sub>` : problem.direction === 'decode' ? `${displayBits(problem.value, problem.format, problem.width)}<sub>${problem.format === 'bin' ? '2' : '16'}</sub>` : `${displayBits(problem.value, problem.format, problem.width)}<sub>${problem.format === 'bin' ? '2' : '16'}</sub>`;
    return { valueHtml, directionText: problem.direction === 'encode' ? `signed decimal to ${REPS[problem.rep]}` : problem.direction === 'decode' ? `${REPS[problem.rep]} to signed decimal` : `${REPS[problem.rep]} to the other representation`, answerLabel: problem.direction === 'encode' ? `Full-width ${FORMATS[problem.format]} bit pattern` : 'Signed decimal', inputmode: problem.direction === 'encode' ? 'text' : 'numeric' };
  },
  check(problem, input) {
    const text = cleanBits(input, problem.format);
    if (!text) return { status: 'empty', message: '' };
    if (problem.direction === 'encode') {
      if (!validDigits(text, problem.format, problem.width)) return { status: 'invalid', message: `Use a full-width ${problem.format === 'bin' ? 'bit pattern' : 'hex pattern'}.` };
      const expected = encode(problem.value, problem.rep, problem.width);
      if (text.length !== digitWidth(problem.format, problem.width)) return { status: 'wrong', message: `Write all ${problem.width} bits.` };
      const parsed = parseBits(text, problem.format, problem.width);
      return parsed === expected ? { status: 'correct', message: 'Correct' } : { status: 'wrong', message: `Not quite. Answer: ${displayBits(expected, problem.format, problem.width)}` };
    }
    if (problem.direction === 'decode') {
      if (!/^-?\d+$/.test(text)) return { status: 'invalid', message: 'Enter a signed decimal integer.' };
      const expected = decode(problem.value, problem.rep, problem.width);
      let parsed;
      try { parsed = BigInt(text); } catch { return { status: 'invalid', message: 'Enter a signed decimal integer.' }; }
      return parsed === expected ? { status: 'correct', message: 'Correct' } : { status: 'wrong', message: `Not quite. Answer: ${String(expected)}` };
    }
    const parsed = parseBits(text, problem.format, problem.width);
    if (parsed === null) return { status: 'invalid', message: `Use a valid ${problem.format === 'bin' ? 'binary' : 'hex'} pattern.` };
    const expected = problem.rep === 'ones' ? encode(problem.value, 'twos', problem.width) : encode(problem.value, 'ones', problem.width);
    return parsed === expected ? { status: 'correct', message: 'Correct' } : { status: 'wrong', message: `Not quite. Answer: ${displayBits(expected, problem.format, problem.width)}` };
  },
  answer(problem) {
    if (problem.direction === 'encode') return displayBits(encode(problem.value, problem.rep, problem.width), problem.format, problem.width);
    if (problem.direction === 'decode') return String(decode(problem.value, problem.rep, problem.width));
    return displayBits(problem.rep === 'ones' ? encode(problem.value, 'twos', problem.width) : encode(problem.value, 'ones', problem.width), problem.format, problem.width);
  },
  work(problem) { return signedWork(problem); },
  statKey: problem => `${problem.rep}${problem.width}:${problem.direction}`,
  statLabel: key => { const [repWidth, direction] = key.split(':'); return `${REPS[repWidth.replace(/\d+$/, '')]} ${repWidth.match(/\d+/)?.[0]} bit, ${direction}`; }
};

function limit(rep, width) { const half = 1n << BigInt(width - 1); return rep === 'twos' ? [-half, half - 1n] : [-(half - 1n), half - 1n]; }
function boundaryValue(rep, width, index) { const [min, max] = limit(rep, width); const values = [min, -1n, 0n, max]; if (index < values.length) return values[index]; const random = BigInt(Math.floor(Math.random() * 0x100000000)); const span = max - min + 1n; return min + ((random << 32n) % span); }
function encode(value, rep, width) { const bits = 1n << BigInt(width); const magnitude = value < 0n ? -value : value; if (value >= 0n) return magnitude; if (rep === 'ones') return (bits - 1n) ^ magnitude; return (bits - magnitude) & (bits - 1n); }
function decode(pattern, rep, width) { const bits = 1n << BigInt(width), mask = bits - 1n; if ((pattern & (1n << BigInt(width - 1))) === 0n) return pattern; if (rep === 'ones') { const magnitude = mask ^ pattern; return magnitude === 0n ? 0n : -magnitude; } return -(bits - pattern); }
function digitWidth(format, width) { return format === 'bin' ? width : width / 4; }
function displayBits(pattern, format, width) { const bits = pattern.toString(2).padStart(width, '0'); return format === 'bin' ? groupBits(bits) : pattern.toString(16).toUpperCase().padStart(width / 4, '0'); }
function validDigits(text, format, width) { return format === 'bin' ? /^[01]+$/.test(text) : /^[0-9a-f]+$/.test(text) && text.length <= width / 4; }
function parseBits(text, format, width) { if (!validDigits(text, format, width) || text.length !== digitWidth(format, width)) return null; const bits = format === 'bin' ? BigInt(`0b${text}`) : BigInt(`0x${text}`); return bits < (1n << BigInt(width)) ? bits : null; }
function toHex(text, format, width) { return (format === 'bin' ? BigInt(`0b${text}`) : BigInt(`0x${text}`)).toString(16).padStart(width / 4, '0'); }
function cleanBits(value, format) { const text = String(value ?? '').trim().toLowerCase().replace(/[\s_]/g, ''); return text.replace(format === 'bin' ? /^0b/ : /^0x/, ''); }
function signedWork(problem) { const value = problem.direction === 'encode' ? problem.value : decode(problem.value, problem.rep, problem.width); const pattern = problem.direction === 'convert' ? answerPattern(problem) : encode(value, problem.rep, problem.width); const bits = pattern.toString(2).padStart(problem.width, '0'); const lines = [`<p class="note">${REPS[problem.rep]}, ${problem.width} bits.</p>`]; if (value < 0n) { lines.push(`<p>Magnitude: ${(-value).toString(2).padStart(problem.width, '0')}</p>`); lines.push(`<p>Invert every bit: ${bits}</p>`); if (problem.rep === 'twos') lines.push('<p>Add 1 to the inverted bits, carrying from the right.</p>'); } else lines.push(`<p>Positive values are padded with leading zeros: ${bits}</p>`); if (problem.rep === 'ones' && pattern === (1n << BigInt(problem.width)) - 1n) lines.push('<p>This is negative zero in ones\' complement.</p>'); lines.push(`<p class="res">Answer: ${displayBits(pattern, problem.format, problem.width)}</p>`); return lines.join(''); }
function answerPattern(problem) { return problem.rep === 'ones' ? encode(problem.value, 'twos', problem.width) : encode(problem.value, 'ones', problem.width); }
export { encode, decode, displayBits };
