'use strict';

const B = { dec: 10, bin: 2, hex: 16, oct: 8 };
const NAME = { dec: 'decimal', bin: 'binary', hex: 'hex', oct: 'octal' };
const BITS = { bin: 1, oct: 3, hex: 4 };
const ORDER = ['dec', 'bin', 'hex', 'oct'];
const SETTINGS_KEY = 'bcp-settings';
const STATS_KEY = 'bcp-stats';

let problems = [];

const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/* ---------- storage ---------- */
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function readSettings() {
  return {
    bases: [...document.querySelectorAll('input[name=base]:checked')].map(i => i.value),
    range: $('#range').value,
    count: $('#count').value,
  };
}
function applySettings(s) {
  if (!s) return;
  document.querySelectorAll('input[name=base]').forEach(i => { i.checked = s.bases.includes(i.value); });
  if ([...$('#range').options].some(o => o.value === s.range)) $('#range').value = s.range;
  if ([...$('#count').options].some(o => o.value === s.count)) $('#count').value = s.count;
}

/* ---------- formatting ---------- */
function raw(n, b) { return n.toString(B[b]).toUpperCase(); }
function fmt(n, b) {
  let s = raw(n, b);
  if (b === 'bin' && s.length > 4) {
    s = s.padStart(Math.ceil(s.length / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1 ');
  }
  return s;
}
function groupRight(s, g) {
  const p = s.padStart(Math.ceil(s.length / g) * g, '0');
  return p.match(new RegExp('.{' + g + '}', 'g'));
}

/* ---------- sheet ---------- */
function generate() {
  const settings = readSettings();
  save(SETTINGS_KEY, settings);
  const bases = settings.bases;
  if (bases.length < 2) { $('#warn').textContent = 'Select at least two bases to convert between.'; return; }
  $('#warn').textContent = '';

  const max = +settings.range, count = +settings.count;
  const pairs = [];
  bases.forEach(a => bases.forEach(b => { if (a !== b) pairs.push([a, b]); }));

  const seen = new Set();
  problems = [];
  let guard = 0;
  while (problems.length < count && guard < 5000) {
    guard++;
    const [from, to] = pairs[rand(0, pairs.length - 1)];
    const value = rand(max > 15 ? 8 : 2, max);
    const k = from + to + value;
    if (seen.has(k)) continue;
    seen.add(k);
    problems.push({ from, to, value, graded: false });
  }
  render();
}

function render() {
  const sheet = $('#sheet');
  sheet.innerHTML = '';
  problems.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'prob';
    const im = p.to === 'hex' ? 'text' : 'numeric';
    li.innerHTML = `
      <span class="num">${i + 1}</span>
      <div class="q"><span class="val">${fmt(p.value, p.from)}<sub>${B[p.from]}</sub></span><span class="dir">${NAME[p.from]} to ${NAME[p.to]}</span></div>
      <label class="ans"><span class="sr">Problem ${i + 1} answer in ${NAME[p.to]}</span><input inputmode="${im}" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <div class="below"><span class="result" aria-live="polite"></span><button class="worklink" aria-expanded="false">Show work</button></div>
      <div class="work" hidden></div>`;

    const input = li.querySelector('input');
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      checkOne(i);
      updateScore();
      const next = sheet.children[i + 1];
      if (next) next.querySelector('input').focus();
    });
    input.addEventListener('input', () => {
      input.classList.remove('ok', 'bad');
      const r = li.querySelector('.result');
      r.textContent = '';
      r.className = 'result';
    });
    li.querySelector('.worklink').addEventListener('click', e => {
      const w = li.querySelector('.work');
      const open = w.hidden;
      if (open && !w.innerHTML) w.innerHTML = work(p);
      w.hidden = !open;
      e.target.setAttribute('aria-expanded', String(open));
      e.target.textContent = open ? 'Hide work' : 'Show work';
    });
    sheet.appendChild(li);
  });

  $('#score').textContent = '';
  $('#key ol').innerHTML = problems
    .map(p => `<li>${fmt(p.value, p.from)}<sub>${B[p.from]}</sub> = ${fmt(p.value, p.to)}<sub>${B[p.to]}</sub></li>`)
    .join('');
}

function parseAns(s, b) {
  s = s.trim().toLowerCase().replace(/[\s_]/g, '');
  const pre = { hex: '0x', bin: '0b', oct: '0o' }[b];
  if (pre && s.startsWith(pre)) s = s.slice(2);
  if (!s) return null;
  const ok = { dec: /^[0-9]+$/, bin: /^[01]+$/, oct: /^[0-7]+$/, hex: /^[0-9a-f]+$/ }[b];
  if (!ok.test(s)) return NaN;
  return parseInt(s, B[b]);
}

function checkOne(i, reveal) {
  const p = problems[i], li = $('#sheet').children[i];
  const input = li.querySelector('input'), res = li.querySelector('.result');
  const v = parseAns(input.value, p.to);
  input.classList.remove('ok', 'bad');

  if (v === null) {
    if (reveal) {
      res.className = 'result bad';
      res.innerHTML = `Answer: <span class="mono">${fmt(p.value, p.to)}</span>`;
      record(p, false);
    }
    return;
  }
  if (Number.isNaN(v)) {
    input.classList.add('bad');
    res.className = 'result bad';
    res.textContent = `That isn't a valid ${NAME[p.to]} number.`;
    return;
  }
  const correct = v === p.value;
  record(p, correct);
  input.classList.add(correct ? 'ok' : 'bad');
  res.className = 'result ' + (correct ? 'ok' : 'bad');
  res.innerHTML = correct ? 'Correct' : `Not quite. Answer: <span class="mono">${fmt(p.value, p.to)}</span>`;
}

function updateScore() {
  let right = 0, tried = 0;
  [...$('#sheet').children].forEach(li => {
    const input = li.querySelector('input');
    if (input.classList.contains('ok')) { right++; tried++; }
    else if (input.classList.contains('bad')) tried++;
  });
  $('#score').textContent = tried ? `${right} of ${problems.length} correct` : '';
}

/* ---------- stats ---------- */
function record(p, correct) {
  if (p.graded) return;          // only the first check on each problem counts
  p.graded = true;
  const stats = load(STATS_KEY, {});
  const k = p.from + '-' + p.to;
  const s = stats[k] || { right: 0, total: 0 };
  s.total++;
  if (correct) s.right++;
  stats[k] = s;
  save(STATS_KEY, stats);
  renderStats();
}

function renderStats() {
  const stats = load(STATS_KEY, {});
  const rows = [];
  ORDER.forEach(a => ORDER.forEach(b => {
    const s = stats[a + '-' + b];
    if (!s) return;
    const pct = Math.round((s.right / s.total) * 100);
    rows.push(`<tr><td>${NAME[a]} to ${NAME[b]}</td><td>${s.right}</td><td>${s.total}</td><td>${pct}%</td></tr>`);
  }));
  $('#stats tbody').innerHTML = rows.length
    ? rows.join('')
    : '<tr><td class="empty" colspan="4">Check some answers and your accuracy by conversion type shows up here.</td></tr>';
}

/* ---------- worked solutions ---------- */
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
      line(`${x} ÷ ${B[t]} = ${q}  remainder ${r}${r > 9 ? ' (' + r.toString(16).toUpperCase() + ')' : ''}`);
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
      line(`${c}${v > 9 ? ' (' + v + ')' : ''} × ${B[f]}<sup>${pw}</sup> = ${v} × ${place} = ${v * place}`);
      parts.push(v * place);
    });
    line(`<span class="res">${parts.join(' + ')} = ${n}</span>`);
  } else if (f === 'bin') {
    const g = BITS[t];
    note(`Group the bits in ${g}s from the right (pad the left with zeros), then convert each group.`);
    groupRight(src, g).forEach(gp => line(`${gp} = ${parseInt(gp, 2).toString(B[t]).toUpperCase()}`));
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
    groupRight(bin, g2).forEach(gp => line(`${gp} = ${parseInt(gp, 2).toString(B[t]).toUpperCase()}`));
    line(`<span class="res">Result: ${fmt(n, t)}</span>`);
  }
  return L.join('');
}

function buildRef() {
  $('#ref tbody').innerHTML = Array.from({ length: 16 }, (_, i) =>
    `<tr><td>${i}</td><td>${i.toString(2).padStart(4, '0')}</td><td>${i.toString(8)}</td><td>${i.toString(16).toUpperCase()}</td></tr>`
  ).join('');
}

/* ---------- wire up ---------- */
$('#newBtn').addEventListener('click', generate);
$('#checkBtn').addEventListener('click', () => { problems.forEach((_, i) => checkOne(i)); updateScore(); });
$('#revealBtn').addEventListener('click', () => { problems.forEach((_, i) => checkOne(i, true)); updateScore(); });
$('#printBtn').addEventListener('click', () => window.print());
$('#resetStats').addEventListener('click', () => {
  if (confirm('Reset all accuracy stats on this device?')) { save(STATS_KEY, {}); renderStats(); }
});
document.querySelectorAll('.controls input, .controls select')
  .forEach(el => el.addEventListener('change', () => save(SETTINGS_KEY, readSettings())));

applySettings(load(SETTINGS_KEY, null));
buildRef();
renderStats();
generate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support unavailable */ });
  });
}
