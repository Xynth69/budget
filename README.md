# Budget — student fuel-panel budget app

Installable iPhone web app (PWA). Tanks drain as you log spending and refill weekly (Monday) or monthly (the 1st); locked bills are ticked off as paid; optional balance shows how long the money lasts. Data lives in the phone's localStorage only. Export a backup from Settings.

## Files
- `index.html`, `css/app.css`, `js/{store,views,app}.js`: the app (no build step, no dependencies)
- `sw.js`: offline cache. **Bump `CACHE` when any shipped file changes**, or phones keep the old copy until the next online launch.
- `manifest.webmanifest`, `icons/`: home-screen install. Regenerate icons with `python3 _tools_make_icons.py icons`
- `fonts/`: self-hosted IBM Plex Sans (variable) + Plex Mono 500/600, latin subset
- `_design-src/`: unpacked Claude Design export (reference only, do not deploy)
- `PRODUCT.md`: design brief used by the impeccable skill

## Run locally
Preview config `student-budget` (port 8190) in `../.claude/launch.json`, or `python3 -m http.server 8190`.

## Deploy
Ship only: `index.html css/ js/ fonts/ icons/ sw.js manifest.webmanifest`. It must be served over HTTPS for the service worker and the home-screen install to work.
