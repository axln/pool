# 8-Ball Pool

Single-file browser pool game for self-play. See `README.md` for controls, rules and architecture; `prompt.md` is the original brief.

## Hard constraints

- Everything stays in `index.html`: no build step, no dependencies, no external assets. All graphics are procedural.
- No AI opponent, menus, login or shop. One person plays both sides.
- The visual design is this game's own. Take generic pool-game cues (felt colour, line weight) from references, but do not copy another game's HUD, layout or art.

## Layout of `index.html`

In order: constants, game state, physics (`step`), rules (`settle`), self-test, WebGL setup and shaders, `makeTable`, `layout`, 2D overlay drawing, `draw`, input, main loop.

- World units: playfield is 1000 × 500 with the origin at its top-left. Convert to CSS pixels with `ox + x * sc`, `oy + y * sc`.
- `CUSHIONS` drives both the collision segments (`SEGS`) and the drawn cushions. Change geometry there, not in two places.
- `POCKETS` radius is both the capture radius and the drawn hole radius.
- Physics must not touch the DOM or GL: the self-test runs `step` headless.
- Balls and the table render in WebGL; HUD, slider, aim guide, cue and text render on the 2D canvas above it.

## Verifying changes

Run the physics self-test after any change to `step`, the constants, cushions or pockets. The title must read `TEST PASS`:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --enable-unsafe-swiftshader \
  --virtual-time-budget=4000 --dump-dom "file://$PWD/index.html?test" 2>/dev/null | grep -o '<title>[^<]*'
```

Take a screenshot after any visual change and look at it:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --enable-unsafe-swiftshader \
  --window-size=1280,760 --force-device-scale-factor=2 --virtual-time-budget=1500 \
  --screenshot=/tmp/pool-shot.png "file://$PWD/index.html"
```

Headless gotchas:

- `--enable-unsafe-swiftshader` is needed for WebGL in headless Chrome.
- `requestAnimationFrame` only fires a few frames under `--virtual-time-budget`, so a shot will not play out. To capture a mid-game state, make a temporary copy of the file with a script appended before `</body>` that sets state directly (for example, give the cue ball a velocity and call `step(DT)` in a loop), and screenshot that copy.
- Synthetic `PointerEvent`s make `setPointerCapture` throw; stub it in the temporary copy.

Headless checks do not cover feel. Ball in hand, the slider, touch input and the 8-ball ending need a human to play them.

## Conventions

- Keep it small: no abstractions, options or features that were not asked for.
- Comments explain why, in one line. A deliberate limit is marked `// shortcut: <limit>, <when to upgrade>`.
- Update `README.md` when controls, rules, tuning constants or known limits change.
