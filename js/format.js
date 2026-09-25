'use strict';

// Shared, DOM-free formatting and parsing helpers used by every problem type.

// Strip spaces, underscores, and matching whitespace so bit patterns and
// numbers can be typed loosely.
export function cleanInput(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/[\s_]/g, '');
}

// Strip a leading base prefix (0x, 0b, 0o), case-insensitive. Also accepts
// a leading sign before the prefix (for signed decimal-looking inputs).
export function stripPrefix(s, prefix) {
  if (!prefix) return s;
  let sign = '';
  if (s[0] === '+' || s[0] === '-') { sign = s[0]; s = s.slice(1); }
  if (s.slice(0, 2).toLowerCase() === prefix) s = s.slice(2);
  return sign + s;
}

// Normalize a base-conversion or bit-pattern answer: trim, drop spaces and
// underscores, drop a matching 0x/0b/0o prefix, lowercase.
export function normalizeInput(raw, prefix) {
  let s = cleanInput(raw).toLowerCase();
  if (prefix) s = stripPrefix(s, prefix);
  return s;
}

// Pad a digit string on the left with zeros so its length is a multiple of
// groupSize (minimum one group), then split into groups from the right.
export function groupFromRight(str, groupSize) {
  const len = Math.max(groupSize, Math.ceil(str.length / groupSize) * groupSize);
  const padded = str.padStart(len, '0');
  const groups = [];
  for (let i = 0; i < padded.length; i += groupSize) groups.push(padded.slice(i, i + groupSize));
  return groups;
}

// Group a full-width bit string in 4s from the right for display.
export function groupBitsDisplay(bits) {
  return groupFromRight(bits, 4).join(' ');
}

export function invertBits(bits) {
  return bits.split('').map(c => (c === '0' ? '1' : '0')).join('');
}

// Random integer in [a, b], inclusive, using Number (safe for small ranges).
export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

// Random BigInt in [min, max], inclusive.
export function randBigInt(min, max) {
  const range = max - min + 1n;
  if (range <= 0n) return min;
  const bitLen = (range - 1n).toString(2).length;
  let r;
  do {
    let s = '';
    for (let i = 0; i < bitLen; i++) s += Math.random() < 0.5 ? '1' : '0';
    r = BigInt('0b' + (s || '0'));
  } while (r >= range);
  return min + r;
}
