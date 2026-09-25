'use strict';

// Fills each lesson's worked example by calling the exact same work()
// functions the practice page uses, on fixed example values, so the
// lesson content and the practice page can never disagree.

import base from './types/base.js';
import signed from './types/signed.js';
import float from './types/float.js';

function put(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// 1: place value intro, decimal to binary
put('ex-1', base.work({ from: 'dec', to: 'bin', value: 13 }));

// 2: any base to decimal (hex to decimal)
put('ex-2', base.work({ from: 'hex', to: 'dec', value: 202 }));

// 3: decimal to any base (decimal to hex)
put('ex-3', base.work({ from: 'dec', to: 'hex', value: 202 }));

// 4: binary to hex by grouping
put('ex-4', base.work({ from: 'bin', to: 'hex', value: 202 }));

// 5: hex to octal through binary
put('ex-5', base.work({ from: 'hex', to: 'oct', value: 202 }));

// 7: one's complement, decimal to bits
put('ex-7', signed.work(signed.example({ repr: 'ones', width: 8, direction: 'toBits', value: -5 })));

// 8: two's complement, decimal to bits
put('ex-8', signed.work(signed.example({ repr: 'twos', width: 8, direction: 'toBits', value: -5 })));

// 9: float layout, a simple single-precision value
put('ex-9', float.work(float.example({ precision: 'single', direction: 'toBits', value: 6.5 })));

// 10: decimal to single precision (the canonical -13.625 example)
const f10 = float.example({ precision: 'single', direction: 'toBits', value: -13.625 });
put('ex-10', float.work(f10));

// 11: single precision back to decimal, same value so the lessons agree
put('ex-11', float.work({ ...f10, direction: 'toDec' }));

// 12: double precision (the canonical 0.1875 example)
put('ex-12', float.work(float.example({ precision: 'double', direction: 'toBits', value: 0.1875 })));

// 13: special values
const specials = [
  float.exampleSpecial({ precision: 'single', kind: 'zero-' }),
  float.exampleSpecial({ precision: 'single', kind: 'inf+' }),
  float.exampleSpecial({ precision: 'single', kind: 'nan' }),
  float.exampleSpecial({ precision: 'single', kind: 'sub+' }),
];
put('ex-13', specials.map(p => float.work(p)).join(''));
