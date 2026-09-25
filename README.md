# Base Conversion Practice

Practice converting numbers between decimal, binary, hexadecimal and octal, signed integers (one's and two's complement), and IEEE 754 floating point (single and double precision). Generates random problem sheets, checks answers, shows worked solutions, tracks accuracy by mode and conversion type, prints with an answer key, and includes a short tutorial. Installable as an app and works offline.

Plain HTML, CSS and JavaScript. No build step, no dependencies.

Check it out for yourself: https://aidanp771.github.io/Base-Conversion-Practice-Gen/

## Modes

- **Base conversion**: decimal, binary, hex, and octal, in any combination.
- **Signed integers**: one's complement, two's complement, or both mixed, at 8, 16, 32, or 64 bits, converting decimal to a bit pattern, a bit pattern to decimal, or converting a bit pattern between the two representations. Bit patterns can be checked in binary or hex.
- **Floating point**: IEEE 754 single (32-bit) or double (64-bit) precision, or both mixed, converting decimal to a bit pattern or a bit pattern to decimal. Bit patterns are always accepted in hex; single precision also offers a split sign/exponent/fraction input as an option. Special values (zero, infinity, NaN, subnormals) can be turned on as an extra option.

## Tutorial

`learn.html` has thirteen short lessons covering number bases, signed integer representations, and IEEE 754 floating point, each with a worked example and a "Practice this" link into the matching practice mode. Every practice problem also has a "Learn how" link back to its lesson.

## URL parameters

Loading `index.html` with query parameters picks a mode and options, overriding saved settings for that mode:

| Parameter | Modes | Values |
|---|---|---|
| `mode` | all | `base`, `signed`, `float` |
| `bases` | base | comma list of `dec`, `bin`, `hex`, `oct` |
| `range` | base | `15`, `255`, `4095`, `65535` |
| `rep` | signed | `ones`, `twos`, `both` |
| `width` | signed | `8`, `16`, `32`, `64` |
| `directions` | signed, float | comma list; signed: `toBits`, `toDec`, `convert`; float: `toBits`, `toDec` |
| `format` | signed | `bin`, `hex` |
| `precision` | float | `32`, `64`, `single`, `double`, `both` |
| `split` | float | `1` to turn on the split sign/exponent/fraction input |
| `specials` | float | `1` to include zero, infinity, NaN, and subnormals |
| `count` | all | `10`, `20`, `30`, `40` |

Examples: `?mode=signed&rep=twos&width=8`, `?mode=float&precision=32`, `?mode=base&bases=bin,hex`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Practice page layout |
| `learn.html` | Tutorial page |
| `styles.css` | Styling, dark mode, print layout, shared by both pages |
| `js/app.js` | DOM wiring for the practice page: mode switching, settings, rendering, checking, stats, print |
| `js/learn.js` | Fills in the tutorial page's worked examples using the same problem-type modules as the practice page |
| `js/format.js` | Shared, DOM-free formatting and parsing helpers |
| `js/types/base.js` | Base conversion problem type |
| `js/types/signed.js` | Signed integer (one's/two's complement) problem type |
| `js/types/float.js` | IEEE 754 floating point problem type |
| `tests/run.mjs` | Test suite, runnable with `node tests/run.mjs` |
| `sw.js` | Service worker for offline use |
| `manifest.webmanifest` | Makes it installable (home screen / desktop app) |
| `icons/` | App icons |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Run locally

Service workers need a real server, so opening `index.html` directly works but won't install or go offline. From the project folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Run the tests

```
node tests/run.mjs
```

This generates problems across every mode and option combination, checks that every generated problem's own answer is accepted, verifies float bit patterns against `DataView`, and checks a handful of hand-picked known cases. No dependencies are needed.

## Deploy to GitHub Pages (If you are reading this on Github you can fork the repo)

1. Create a new repo on GitHub (for example `base-practice`).
2. Push these files to the root of the `main` branch:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/base-practice.git
   git push -u origin main
   ```
3. On GitHub go to **Settings > Pages**, set Source to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute it's live at `https://YOUR-USERNAME.github.io/base-practice/`

All paths are relative, so it works from a repo subfolder without changes.

## Updating

When you change any file, bump the cache name in `sw.js` (`bcp-v2` to `bcp-v3`, etc.) so installed copies pick up the new version.

## Data

Settings and accuracy stats are saved in the browser's localStorage on each device, namespaced per mode. Nothing is sent anywhere.
