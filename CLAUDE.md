# 8-Ball Pool

Browser pool game for self-play, no build step. See `README.md` for controls, rules and architecture; `prompt.md` is the original brief.

## Hard constraints

- Plain ES modules in `src/`, loaded by `index.html`: no build step, no dependencies, no external assets. All graphics are procedural.
- No AI opponent, menus, login or shop. One person plays both sides.
- The visual design is this game's own. Take generic pool-game cues (felt colour, line weight) from references, but do not copy another game's HUD, layout or art.

## Code layout (`src/`)

One responsibility per module; dependencies point from `main.js` down to `constants.js`.

| Module | Responsibility |
|---|---|
| `constants.js` | World size, tuning constants, pockets, cushions |
| `game.js` | `createGame`, `rack`, `findCueBall`, `isFreeSpot` |
| `physics.js` | `step` (motion, collisions, potting), `animateSinking` (pocket-drop animation) |
| `rules.js` | `fire` (shot starts), `settle` (all balls stopped) |
| `selftest.js` | `runSelfTest`: headless physics check |
| `view.js` | `layout` (window fit, returns the view), world-to-pixel helpers, HUD positions |
| `table.js` | `drawTable`: the procedural table canvas |
| `gl.js` | `createRenderer`, shaders, `drawBall`, `drawShadow`, table/atlas textures |
| `render.js` | `render`: one frame, table, shadows, balls, then the overlay |
| `overlay.js` | `drawOverlay`: HUD, slider, aim guide, cue, messages on the 2D canvas |
| `input.js` | `bindInput`: pointer events |
| `main.js` | `main` (called from `index.html`) and the frame loop |

- `main` creates the `app` object (`game`, `view`, renderer, canvases) and passes what each function needs. No module holds state of its own.
- World units: playfield is 1000 × 500 with the origin at its top-left. Convert to CSS pixels with `toScreenX(view, x)`, `toScreenY(view, y)` from `view.js`.
- `CUSHIONS` drives both the collision segments (`SEGS`) and the drawn cushions. Change geometry there, not in two places.
- `POCKETS` radius is both the capture radius and the drawn hole radius.
- `constants.js`, `game.js`, `physics.js`, `rules.js` and `selftest.js` must not touch the DOM or GL: the self-test runs `step` headless.
- Balls and the table render in WebGL; HUD, slider, aim guide, cue and text render on the 2D canvas above it.

## Verifying changes

Modules do not load from `file://`, so serve the folder first (`npx serve .` or `python3 -m http.server 8765`). The commands below assume port 8765.

Run the physics self-test after any change to `step`, the constants, cushions or pockets. The title must read `TEST PASS`:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --enable-unsafe-swiftshader \
  --virtual-time-budget=4000 --dump-dom "http://127.0.0.1:8765/index.html?test" 2>/dev/null | grep -o '<title>[^<]*'
```

Take a screenshot after any visual change and look at it:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --enable-unsafe-swiftshader \
  --window-size=1280,760 --force-device-scale-factor=2 --virtual-time-budget=1500 \
  --screenshot=/tmp/pool-shot.png "http://127.0.0.1:8765/index.html"
```

Headless gotchas:

- `--enable-unsafe-swiftshader` is needed for WebGL in headless Chrome.
- `requestAnimationFrame` only fires a few frames under `--virtual-time-budget`, so a shot will not play out. To capture a mid-game state, make a temporary copy of `index.html` next to it whose module script does `const app = main();` and then sets `app.game` fields directly, screenshot that copy, then delete it.
- Synthetic `PointerEvent`s make `setPointerCapture` throw; stub it in the temporary copy.

Headless checks do not cover feel. Ball in hand, the slider, touch input and the 8-ball ending need a human to play them.

## Conventions

- Keep it small: no abstractions, options or features that were not asked for.
- Comments explain why, in one line. A deliberate limit is marked `// shortcut: <limit>, <when to upgrade>`.
- Refactors are checked against a baseline taken before the change: `TEST PASS`, a checksum of ball positions after scripted breaks, and pixel-identical screenshots of fixed scenes with `Math.random` seeded.

## Code Style

Format code consistently following standard conventions (e.g., 4 spaces, single quotes). Write new code in the existing style of the repository without reformatting untouched files.

Follow Clean Code principles (Robert C. Martin) so that the code reads like prose. Treat these rules as guidelines for new code and edits rather than strict dogma: if a rule hurts clarity or performance, prioritize clarity and explain the deviation in a comment or response. On performance-critical paths (such as frame loops or real-time data processing), avoid splitting functions just for the sake of splitting—shared temporary variables and step ordering must remain obvious.

- **Top-down module structure:** Imports → declarations block (constants, lookup tables, simple state holders) → functions. Function order follows the Stepdown Rule: a caller is always placed above its callee, and callees appear in the order they are invoked (`main` → `process` → `update`, not the reverse). Visibility (public/exported vs. private) does not dictate order; public functions may sit between private ones. If a function has multiple callers, place it below the last caller. In the entry module, place the `main` entry point immediately after top-level declarations, and trigger it externally so the entry point remains clearly visible near the top of the file.
- **No executable code at module/global scope.** Perform all side effects (initializing components, registering listeners, starting loops) inside the entry point via named functions. Keep only declarations at the top level, placed above `main`. Pass state explicitly via parameters and return values rather than sharing mutable variables across modules. The only exception is encapsulated state owned strictly by a single module (e.g., an internal cache or state manager).
- **Use standard named function declarations** at the module level rather than variable-assigned lambdas or arrow functions, ensuring functions can be called freely regardless of declaration order (hoisting/forward readability). Reserve anonymous/arrow functions for short callbacks and lookup table entries.
- **Small, single-responsibility functions** operating at a single level of abstraction. Prefer extracting a long function over writing section comments inside it—unless splitting obscures the connection between steps (such as shared state or strict execution order).
- **Descriptive naming** without abbreviations (`moveX`, not `mx`). Extract magic numbers and hardcoded literals into named constants.
- **No global state**, no dead code, and no unused variables. Pass data explicitly through function arguments and return values.
- **Replace large `switch` or `if-else` chains with lookup tables** mapping `key → handler` (e.g., `KEY_ACTIONS`, `HANDLERS`).
- **Refactoring must never alter existing behavior.**

Project notes on applying it:

- Standard math notation (`x`, `y`, `dx`, `dy`, `vx`, `vy`, `dt`) counts as descriptive in physics and geometry code.
- GLSL shader source in `gl.js` keeps its compact two-space style; it is a string, not JavaScript.
- Colours and gradient stops live in named lookup tables at the top of each drawing module; one-off text sizes and small label offsets stay inline where a name would add nothing.
- Update `README.md` when controls, rules, tuning constants or known limits change.
