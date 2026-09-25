import assert from 'node:assert/strict';
import { base } from '../js/types/base.js';
import { signed, encode as signedEncode } from '../js/types/signed.js';
import { float, bitsOf, patternHex } from '../js/types/float.js';

let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
function exercise(type, options) {
  for (let batch = 0; batch < 12; batch++) {
    const problems = type.generate(options, 40);
    check(problems.length === 40, `${type.id} generated 40 problems`);
    for (const problem of problems) check(type.check(problem, type.answer(problem)).status === 'correct', `${type.id} answer checks: ${JSON.stringify(problem, (_, value) => typeof value === 'bigint' ? `${value}n` : value)}`);
  }
}

try {
  for (const bases of [['dec', 'bin'], ['dec', 'hex'], ['dec', 'oct'], ['bin', 'hex'], ['hex', 'oct'], ['dec', 'bin', 'hex', 'oct']]) exercise(base, { ...base.defaults, bases, count: '40' });
  for (const rep of ['ones', 'twos', 'both']) for (const width of ['8', '16', '32', '64']) for (const format of ['bin', 'hex']) exercise(signed, { ...signed.defaults, rep, width, format, count: '40' });
  for (const precision of ['32', '64', 'both']) for (const direction of ['encode', 'decode', 'both']) for (const format of ['hex', 'bin']) exercise(float, { ...float.defaults, precision, direction, format, count: '40', special: false });
  check(patternHex(bitsOf(-13.625, 32), 32) === 'C15A0000', 'float32 -13.625 is C15A0000');
  check(signedEncode(-1n, 'twos', 8) === 0xFFn, '8-bit two\'s complement -1 is FF');
  check(signedEncode(-1n, 'ones', 8) === 0xFEn, '8-bit ones\' complement -1 is FE');
  check(patternHex(bitsOf(0.1875, 64), 64) === '3FC8000000000000', 'float64 0.1875 is 3FC8000000000000');
  console.log(`PASS: ${checks} assertions`);
} catch (error) {
  console.error(`FAIL after ${checks} assertions: ${error.message}`);
  process.exitCode = 1;
}
