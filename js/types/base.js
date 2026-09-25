import { groupRight, normalizeInput, escapeHtml } from '../format.js';

const BASES = { dec: 10, bin: 2, hex: 16, oct: 8 };
const NAMES = { dec: 'decimal', bin: 'binary', hex: 'hex', oct: 'octal' };
const BITS = { bin: 1, oct: 3, hex: 4 };
const ORDER = ['dec', 'bin', 'hex', 'oct'];

export const base = {
  id: 'base',
  label: 'Base conversion',
  defaults: { bases: ['dec', 'bin', 'hex', 'oct'], range: '255', count: '20' },
  renderOptions(settings) {
    return `<fieldset><legend>Bases to include</legend><div class="checks">${ORDER.map(key => `<label><input type="checkbox" name="base" value="${key}" ${settings.bases.includes(key) ? 'checked' : ''}> ${NAMES[key][0].toUpperCase() + NAMES[key].slice(1)}</label>`).join('')}</div></fieldset>
      <div><label class="lbl" for="range">Number size</label><select id="range"><option value="15" ${settings.range === '15' ? 'selected' : ''}>Up to 15 (one hex digit)</option><option value="255" ${settings.range === '255' ? 'selected' : ''}>Up to 255 (one byte)</option><option value="4095" ${settings.range === '4095' ? 'selected' : ''}>Up to 4095 (12 bits)</option><option value="65535" ${settings.range === '65535' ? 'selected' : ''}>Up to 65535 (two bytes)</option></select></div>
      <div><label class="lbl" for="count">Problems</label><select id="count">${[10, 20, 30, 40].map(n => `<option ${String(n) === String(settings.count) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  },
  readOptions(root) {
    return { bases: [...root.querySelectorAll('input[name=base]:checked')].map(input => input.value), range: root.querySelector('#range').value, count: root.querySelector('#count').value };
  },
  generate(settings, count = Number(settings.count)) {
    const pairs = settings.bases.flatMap(from => settings.bases.filter(to => to !== from).map(to => [from, to]));
    const max = Number(settings.range), problems = [], seen = new Set();
    let guard = 0;
    while (problems.length < count && guard++ < 10000 && pairs.length) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const value = Math.floor(Math.random() * (max - (max > 15 ? 8 : 2) + 1)) + (max > 15 ? 8 : 2);
      const key = `${pair[0]}-${pair[1]}-${value}`;
      if (seen.has(key)) continue;
      seen.add(key); problems.push({ from: pair[0], to: pair[1], value, graded: false });
    }
    return problems;
  },
  prompt(problem) {
    return { valueHtml: `${format(problem.value, problem.from)}<sub>${BASES[problem.from]}</sub>`, directionText: `${NAMES[problem.from]} to ${NAMES[problem.to]}`, answerLabel: `Answer in ${NAMES[problem.to]}`, inputmode: problem.to === 'hex' ? 'text' : 'numeric' };
  },
  check(problem, input) {
    const value = parse(input, problem.to);
    if (value === null) return { status: 'empty', message: '' };
    if (Number.isNaN(value)) return { status: 'invalid', message: `That isn't a valid ${NAMES[problem.to]} number.` };
    return value === problem.value ? { status: 'correct', message: 'Correct' } : { status: 'wrong', message: `Not quite. Answer: ${format(problem.value, problem.to)}` };
  },
  answer: problem => format(problem.value, problem.to),
  work(problem) { return conversionWork(problem); },
  statKey: problem => `${problem.from}-${problem.to}`,
  statLabel: key => { const [from, to] = key.split('-'); return `${NAMES[from]} to ${NAMES[to]}`; }
};

export function raw(value, base) { return value.toString(BASES[base]).toUpperCase(); }
export function format(value, base) {
  let text = raw(value, base);
  if (base === 'bin' && text.length > 4) text = groupRight(text, 4).join(' ');
  return text;
}

function parse(input, base) {
  const text = normalizeInput(input);
  if (!text) return null;
  const pattern = { dec: /^[0-9]+$/, bin: /^[01]+$/, oct: /^[0-7]+$/, hex: /^[0-9a-f]+$/ }[base];
  if (!pattern.test(text)) return NaN;
  return parseInt(text, BASES[base]);
}

function conversionWork(problem) {
  const { value, from, to } = problem, source = raw(value, from), lines = [];
  const note = text => lines.push(`<p class="note">${text}</p>`);
  const line = text => lines.push(`<p>${text}</p>`);
  if (from === 'dec') {
    note(`Divide by ${BASES[to]} repeatedly. Read the remainders from bottom to top.`);
    let current = value;
    do { const quotient = Math.floor(current / BASES[to]); const remainder = current % BASES[to]; line(`${current} / ${BASES[to]} = ${quotient}, remainder ${remainder}`); current = quotient; } while (current);
    line(`<span class="res">Result: ${format(value, to)}</span>`);
  } else if (to === 'dec') {
    note(`Multiply each digit by its place value and add the results.`);
    const parts = [...source].map((digit, index) => { const digitValue = parseInt(digit, BASES[from]); const power = source.length - index - 1; return `${digitValue} x ${BASES[from]}<sup>${power}</sup>`; });
    line(`${parts.join(' + ')} = ${value}`);
  } else {
    const sourceBits = from === 'bin' ? source : [...source].map(digit => parseInt(digit, BASES[from]).toString(2).padStart(BITS[from], '0')).join('');
    note(`Convert through binary, grouping from the right in ${BITS[to]}s.`);
    line(`Binary: ${groupRight(sourceBits, 1).join('')}`);
    line(`<span class="res">Result: ${format(value, to)}</span>`);
  }
  return lines.join('');
}

export { BASES, NAMES };
