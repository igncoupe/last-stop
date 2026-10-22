# Gameplay regression checks

Serve the repository root over HTTP (for example, `python -m http.server 8765 --bind 127.0.0.1`). Install Playwright in your development environment, then run:

```powershell
$env:GAME_URL = 'http://127.0.0.1:8765'
$env:BROWSER_CHANNEL = 'msedge'
node tools/gameplay-regression.mjs
```

`PLAYWRIGHT_PATH` optionally points to an existing Playwright package; `REPORT_PATH` saves JSON results. The runner uses headless Edge on Windows by default. Set `BROWSER_CHANNEL` to another installed Chromium channel as needed.

The runner checks the actual player, input, passenger, director, bus, and Night 4 modules in the browser. Private scene helpers are exported only in intercepted test responses. No test exports are shipped to the game.

Coverage at simulated 15, 30, 60, and 144 FPS:

- Rear camera limit crossing, slow mouse override of scripted look, input clearing on transitions/blur/lock changes, and idempotent listener initialization.
- Both Carmen variants: fourteen total passengers, every new arrival passing through the door, seat completion, movement continuity, and spacing.
- Continuous five-second shallow water rise.
- Constant bridge cruise, safe waiting at the decision, acceleration from cruise and from the safety stop.
- Both bridge outcomes, velocity handoff to the fall, finite crash physics, underwater dialogue, and restoration of route movement and underwater effects.

Focused bridge tests replace speech durations, choices, and fades with controlled simulation-time waits. They are not a substitute for listening to the scene in real time.

For full Night 4 integration, open each URL and inspect `window.__botReport` after Night 5 begins:

- `/?test&fast=10&bot=kind&night=4&flags=rheeTruth,maraHelped,junRode,visitedVarga`
- `/?test&fast=10&bot=cold&night=4&flags=rheeTruth,maraHelped,junRode,visitedVarga`

Both completed on Windows/Edge with no reported errors or stuck states on 2026-10-22. Rendered boarding and seated-cabin snapshots were inspected. All focused checks passed.

Manual release checks still needed: physical high-DPI mouse and pointer lock across Alt-Tab/pause, a real-time listen-through, and the packaged Electron application on representative Windows hardware. The complete five-night story and every ending were not replayed in this change.
