# Base Conversion Practice

Practice converting numbers between decimal, binary, hexadecimal and octal. Generates random problem sheets, checks answers, shows worked solutions, tracks accuracy by conversion type, and prints with an answer key. Installable as an app and works offline.

Plain HTML, CSS and JavaScript. No build step, no dependencies.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `styles.css` | Styling, dark mode, print layout |
| `app.js` | Problem generation, checking, worked solutions, stats |
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

When you change any file, bump the cache name in `sw.js` (`bcp-v1` to `bcp-v2`, etc.) so installed copies pick up the new version.

## Data

Settings and accuracy stats are saved in the browser's localStorage on each device. Nothing is sent anywhere.
