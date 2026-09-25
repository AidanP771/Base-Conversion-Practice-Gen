'use strict';

// DOM layer: mode switching, settings, rendering, checking, stats, print,
// and service worker registration. Problem logic itself lives in
// ./types/*.js and is DOM-free.

import base from './types/base.js';
import signed from './types/signed.js';
import float from './types/float.js';

const MODES = [base, signed, float];
const MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m]));
const MODE_KEY = 'bcp-mode';
const COUNT_KEY = 'bcp-count';
const STATS_KEY = 'bcp-stats';
const COUNTS = ['10', '20', '30', '40'];
const settingsKey = id => `bcp-settings-${id}`;

let activeMode = MODES[0];
let currentMode = activeMode; // the mode that generated the problems on screen
let problems = [];

const $ = s => document.querySelector(s);

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

/* ---------- stats migration ---------- */
function migrateStats() {
  const stats = load(STATS_KEY, {});
  let changed = false;
  for (const key of Object.keys(stats)) {
    if (!key.includes(':') && /^(dec|bin|hex|oct)-(dec|bin|hex|oct)$/.test(key)) {
      stats[`base:${key}`] = stats[key];
      delete stats[key];
      changed = true;
    }
  }
  if (changed) save(STATS_KEY, stats);
  return stats;
}

/* ---------- per-mode settings ---------- */
function loadModeSettings(mode) { return { ...mode.defaults, ...load(settingsKey(mode.id), {}) }; }
function saveModeSettings(mode, settings) { save(settingsKey(mode.id), settings); }

function loadCount() {
  const c = load(COUNT_KEY, '20');
  return COUNTS.includes(String(c)) ? String(c) : '20';
}

/* ---------- mode selector + options panel ---------- */
function renderModeSelector() {
  $('#modeSelect').innerHTML = `
    <fieldset>
      <legend>Practice mode</legend>
      <div class="checks">
        ${MODES.map(m => `<label><input type="radio" name="mode" value="${m.id}" ${m.id === activeMode.id ? 'checked' : ''}> ${m.label}</label>`).join('')}
      </div>
    </fieldset>`;
}

function renderModeOptions(settings) {
  $('#modeOptions').innerHTML = activeMode.renderOptions(settings ?? loadModeSettings(activeMode));
}

function renderCountSelect() {
  const count = loadCount();
  $('#count').innerHTML = COUNTS.map(c => `<option${c === count ? ' selected' : ''}>${c}</option>`).join('');
}

/* ---------- URL params ---------- */
function applyUrlParams() {
  const params = new URLSearchParams(location.search);
  const savedMode = load(MODE_KEY, 'base');
  activeMode = MODE_BY_ID[params.get('mode')] || MODE_BY_ID[savedMode] || MODES[0];
  save(MODE_KEY, activeMode.id);

  let settings = loadModeSettings(activeMode);
  if (activeMode.settingsFromParams) {
    settings = activeMode.settingsFromParams(params, settings);
    saveModeSettings(activeMode, settings);
  }

  if (params.has('count') && COUNTS.includes(params.get('count'))) save(COUNT_KEY, params.get('count'));

  renderModeSelector();
  renderCountSelect();
  renderModeOptions(settings);
}

/* ---------- generation ---------- */
function generate() {
  const settings = activeMode.readOptions($('#modeOptions'));
  saveModeSettings(activeMode, settings);
  const count = +loadCount();

  const result = activeMode.generate(settings, count);
  if (result && result.error) {
    $('#warn').textContent = result.error;
    problems = [];
    currentMode = activeMode;
    render();
    return;
  }
  $('#warn').textContent = '';
  problems = result;
  currentMode = activeMode;
  render();
}

/* ---------- rendering ---------- */
function render() {
  const sheet = $('#sheet');
  sheet.innerHTML = '';
  problems.forEach((p, i) => {
    const info = currentMode.prompt(p);
    const li = document.createElement('li');
    li.className = 'prob';

    const answerHtml = info.fields
      ? `<span class="fieldset-ans">${info.fields.map((f, fi) =>
          `<label class="field-in"><span class="sr">Problem ${i + 1}, ${f.label}</span><input class="fpart" data-i="${fi}" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="${f.width}" size="${Math.max(f.width, 2)}"><span class="field-lbl">${f.label}</span></label>`
        ).join('')}</span>`
      : `<label class="ans"><span class="sr">Problem ${i + 1} ${info.answerLabel}</span><input inputmode="${info.inputmode}" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>`;

    li.innerHTML = `
      <span class="num">${i + 1}</span>
      <div class="q"><span class="val">${info.valueHtml}</span><span class="dir">${info.directionText}</span></div>
      ${answerHtml}
      <div class="below">
        <span class="result" aria-live="polite"></span>
        <button class="worklink" aria-expanded="false">Show work</button>
        <a class="learnlink" href="./learn.html#${currentMode.lessonAnchor ? currentMode.lessonAnchor(p) : ''}">Learn how</a>
      </div>
      <div class="work" hidden></div>`;

    const inputs = () => [...li.querySelectorAll('input')];

    const focusNext = () => {
      const next = sheet.children[i + 1];
      if (next) next.querySelector('input').focus();
    };

    inputs().forEach((input, idx) => {
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        checkOne(i);
        updateScore();
        focusNext();
      });
      input.addEventListener('input', () => {
        inputs().forEach(inp => inp.classList.remove('ok', 'bad'));
        const r = li.querySelector('.result');
        r.textContent = '';
        r.className = 'result';
      });
    });

    li.querySelector('.worklink').addEventListener('click', e => {
      const w = li.querySelector('.work');
      const open = w.hidden;
      if (open) w.innerHTML = currentMode.work(p);
      w.hidden = !open;
      e.target.setAttribute('aria-expanded', String(open));
      e.target.textContent = open ? 'Hide work' : 'Show work';
    });

    sheet.appendChild(li);
  });

  $('#score').textContent = '';
  $('#key ol').innerHTML = problems
    .map(p => `<li>${currentMode.prompt(p).valueHtml} = ${currentMode.answer(p)}</li>`)
    .join('');
}

function checkOne(i, reveal) {
  const p = problems[i], li = $('#sheet').children[i];
  const inputs = [...li.querySelectorAll('input')];
  const answerStr = inputs.map(inp => inp.value).join(' ');
  const res = li.querySelector('.result');
  inputs.forEach(inp => inp.classList.remove('ok', 'bad'));

  const r = currentMode.check(p, answerStr);

  if (r.status === 'empty') {
    if (reveal) {
      res.className = 'result bad';
      res.innerHTML = `Answer: <span class="mono">${currentMode.answer(p)}</span>`;
      record(p, false);
    }
    return;
  }
  if (r.status === 'invalid') {
    inputs.forEach(inp => inp.classList.add('bad'));
    res.className = 'result bad';
    res.textContent = r.message;
    return;
  }
  const correct = r.status === 'correct';
  record(p, correct);
  inputs.forEach(inp => inp.classList.add(correct ? 'ok' : 'bad'));
  res.className = 'result ' + (correct ? 'ok' : 'bad');
  res.innerHTML = r.message;
}

function updateScore() {
  let right = 0, tried = 0;
  [...$('#sheet').children].forEach(li => {
    const inputs = [...li.querySelectorAll('input')];
    if (!inputs.length) return;
    if (inputs.every(i => i.classList.contains('ok'))) { right++; tried++; }
    else if (inputs.some(i => i.classList.contains('bad'))) tried++;
  });
  $('#score').textContent = tried ? `${right} of ${problems.length} correct` : '';
}

/* ---------- stats ---------- */
let statsGraded = new WeakSet();

function record(p, correct) {
  if (statsGraded.has(p)) return; // only the first check on each problem counts
  statsGraded.add(p);
  const stats = load(STATS_KEY, {});
  const k = currentMode.statKey(p);
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
  MODES.forEach(mode => {
    const modeRows = [];
    Object.keys(stats).forEach(key => {
      const label = mode.statLabel(key);
      if (label == null) return;
      const s = stats[key];
      const pct = Math.round((s.right / s.total) * 100);
      modeRows.push(`<tr><td>${label}</td><td>${s.right}</td><td>${s.total}</td><td>${pct}%</td></tr>`);
    });
    if (modeRows.length) {
      rows.push(`<tr class="stat-group"><td colspan="4">${mode.label}</td></tr>`);
      rows.push(...modeRows);
    }
  });
  $('#stats tbody').innerHTML = rows.length
    ? rows.join('')
    : '<tr><td class="empty" colspan="4">Check some answers and your accuracy by conversion type shows up here.</td></tr>';
}

/* ---------- quick reference (base mode only, unchanged) ---------- */
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

$('#modeSelect').addEventListener('change', e => {
  if (e.target.name !== 'mode') return;
  activeMode = MODE_BY_ID[e.target.value];
  save(MODE_KEY, activeMode.id);
  renderModeSelector();
  renderModeOptions();
  generate();
});

$('#modeOptions').addEventListener('change', () => {
  const settings = activeMode.readOptions($('#modeOptions'));
  saveModeSettings(activeMode, settings);
  renderModeOptions(settings);
});

$('#count').addEventListener('change', () => save(COUNT_KEY, $('#count').value));

migrateStats();
applyUrlParams();
buildRef();
renderStats();
generate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support unavailable */ });
  });
}
