# 8-Ball Pool

A dependency-free 8-ball pool game for the browser. One person plays both sides on one screen: no menus, no login, no AI opponent.

## Run

```sh
yarn install
yarn dev        # dev server with hot reload at http://localhost:5173
yarn build      # static site in dist/, deployable to any static host
yarn preview    # serve the built dist/ locally
yarn format     # format everything with Prettier (default rules)
```

Vite and Prettier are the only dependencies, both for development; the game itself uses no libraries. WebGL is required.

## Deploy

`.github/workflows/pages.yml` builds with `yarn build --base=./` and publishes `dist/` to GitHub Pages on every push to `main` (or by hand: `gh workflow run pages.yml`). One-time setup: Settings → Pages → Source = "GitHub Actions". The game is then at https://axln.github.io/pool/.

## Controls

| Action                             | Mouse                                             | Touch                               |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Aim                                | Move the pointer around the cue ball              | Drag on the table                   |
| Shoot                              | Press, drag backward, release                     | Drag the power slider down, release |
| Shoot (alternative)                | Drag the power slider on the left down, release   |                                     |
| Place the cue ball after a scratch | Drag anywhere on the table (the cursor is a hand) | Drag the cue ball                   |
| New rack                           | `Reset Rack` button, bottom-right                 | Same                                |

The bottom-left corner shows the frame rate and, as `worst`, the rate the slowest frame of each half second would give if every frame were that slow, so single hitches show up.

Aim is locked while you pull back with the mouse. A pull shorter than 3% power cancels the shot.

## Rules

The rules are deliberately light, for self-play:

- Standard triangle rack, randomised each game: 8-ball in the centre, one solid and one stripe in the back corners, the rest shuffled. Cue ball on the head string.
- The top bar shows whose turn it is, and the player's group once assigned. The first ball potted on the open table (without a scratch) gives that player its group, solids or stripes; the opponent gets the other, announced for a moment in the table centre. The turn passes when a shot pots none of the shooter's own balls or scratches; otherwise the same player shoots again.
- Scratch: the cue ball returns to the head string and is in hand: press anywhere on the table and drag to move it to any free spot, release to drop it. The aim guide then appears and you shoot as usual; until the shot you can still grab the cue ball (hand cursor over it) and move it again.
- Potting the 8-ball ends the rack: a win if the shooter's group was already cleared by an earlier shot and the cue ball stayed up, a loss otherwise (the message says why).
- Potted solids collect on the left of the top bar, stripes on the right.

Not implemented: first-contact fouls, call-pocket, break fouls, spin control (english, and choosing top, back or side spin).

## How it works

`index.html` holds the markup and CSS and loads `src/main.js`. The JavaScript is split into small ES modules, one responsibility each; see the table in `CLAUDE.md`.

**Coordinates.** The playfield is 1000 × 500 world units with the origin at its top-left; the ball radius is 11.25 (regulation ratio). `layout()` computes one scale and offset to fit the window, and re-runs on resize.

**Physics** (`step`)

- Runs once per displayed frame, using a smoothed frame time (`FRAME_TIME_SMOOTHING` in `src/main.js`) so timer jitter does not show as uneven motion, and is split into sub-steps so no ball moves more than 0.4 radius per sub-step. This prevents tunneling on the break.
- Ball–ball: equal-mass impulse along the contact normal (restitution 0.96) plus position correction. Contact friction (`BALL_FRICTION`) also drags the balls along the contact tangent, so a cut ball is thrown up to about 3° off the line of centres towards the cue's path (less for thin cuts, because the balls also pick up side spin); it only removes sliding, so it never adds energy. Pairs are checked in a random order, in 3 passes per sub-step (`BALL_COLLISION_PASSES`), so energy travels through the rack at once and simultaneous contacts (the break) are not biased by ball order.
- Cushions: 18 line segments (6 noses and their angled pocket jaws), circle-vs-segment collision, restitution 0.85 for a slow ball falling to about 0.77 at speed 1000 and 0.64 at full power. Cushion friction (`CUSHION_FRICTION`) removes some of the ball's sliding along the wall, so a bank comes off about 3° steeper and the ball leaves with side spin.
- Skid, then roll: each ball has a spin (`wx`, `wy`, about the horizontal axes). Where the ball touches the cloth it slips whenever the spin does not match its speed (rolling means `wy = vx / R`, `wx = -vy / R`). While it slips, sliding friction (`SLIDING_FRICTION * GRAVITY`) slows the ball and changes its spin until the slip is gone, then it rolls. A hit ball starts without spin, so it skids first. Collisions change speed only, so the spin left behind makes follow, stun and draw happen by themselves: a cue ball that hits an object ball close by stops, one that hits from far away follows through. Skidding costs a ball 2/7 of its energy, which is why `MAX_SHOT_SPEED` is higher than the old 2600.
- Side spin: a third spin, `wz`, about the vertical axis. It is created by friction at a cushion or between two balls (a cut), changes the next rebound or throw, and fades on the cloth at `SIDE_SPIN_DECAY`. It does not change how a ball skids. A ball that is still spinning on the spot when the shot ends loses its spin when the turn changes.
- Rolling friction: speed-proportional drag plus a constant rolling deceleration, so balls slow smoothly and stop completely.
- Cloth drift: below `CLOTH_DRIFT_MAX_SPEED` a ball's direction turns by a small random amount (speed unchanged), so slow rolls wander slightly off a straight line; fast balls are unaffected.
- Pockets: a ball is potted when its centre comes within the pocket's capture radius, unless it is fast and enters off-centre: the faster the ball, the closer to head-on it must come (up to `POCKET_ENTRY_NARROWING` of the radius at full shot speed), otherwise it hits the rim and rattles back out (`POCKET_RIM_RESTITUTION`). Slow balls are not affected.
- Orientation: each ball carries a 3 × 3 orientation matrix, rotated by its spin each sub-step (`rotateBall`); a ball dropping into a pocket just rolls with its movement (`rollBall`).

**Rendering** uses two stacked canvases.

- WebGL (below): the table, ball shadows and balls. The table is drawn procedurally once per resize on an offscreen 2D canvas (`drawTable`) and uploaded as a texture. Its wood grain and felt noise come from fixed seeds, so it looks the same on every load. Each cushion has a lit rubber bevel along its nose and both pocket jaws. The felt shows the head string and head spot; the foot spot is left unmarked so the rack area stays clean. Each ball is a quad whose fragment shader ray-casts a sphere, maps the stripe, number spot and cue-ball dot through the ball's orientation, and applies lighting. Numbers come from a small generated texture atlas. Each ball has two shadows: a tight contact shadow at its edge, and a soft lamp shadow that leans away from the table centre and stretches towards the rails (`CONTACT_SHADOW`, `LAMP_SHADOW` in `src/render.js`).
- 2D canvas (above): HUD, power slider, aim guide (line, ghost ball, deflection lines, with a soft dark outline), cue stick and messages.

**Sound** (`src/sound.js`) plays recorded clips from `public/sounds/`: the "Pool And Billiards SFX" pack by Suraj Kispotta, CC0 (see `public/sounds/CREDITS.md`). Physics records each impact in `game.events` as `{ type, speed }` (`cue`, `ball`, `rail`, `pocket`). Every frame the loudest few are played, each with a random take of its clip, a slight pitch variation, and a volume that follows the impact speed. Browsers allow audio only after a user gesture, so the clips load and the sound starts with the first click or touch.

**Game flow.** `game.state` is one of `aim`, `strike` (cue animation), `moving` or `over`. `settle()` runs when every ball has stopped and applies the rules above.

## Tuning

The constants in `src/constants.js` control the feel:

| Constant                                           | Meaning                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MAX_SHOT_SPEED`                                   | Cue-ball speed at full power                                                                                                        |
| `GRAVITY`, `SLIDING_FRICTION`, `SLIP_EPSILON`      | Skidding: gravity (units/s², one unit is 2.54 mm), friction while a ball slips, and the slip speed below which it counts as rolling |
| `DRAG`, `ROLLING_RESISTANCE`                       | Friction: proportional and constant parts                                                                                           |
| `CUSHION_FRICTION`, `SIDE_SPIN_DECAY`              | Ball–cushion friction, and the rate (rad/s²) at which the cloth takes off side spin                                                 |
| `BALL_FRICTION`                                    | Friction between two balls in contact (cut-shot throw)                                                                              |
| `BALL_RESTITUTION`                                 | Restitution for ball–ball hits                                                                                                      |
| `RAIL_RESTITUTION_SLOW`, `_LOSS`, `_MIN`           | Cushion restitution: value for a slow ball, loss per unit of impact speed, floor                                                    |
| `CLOTH_DRIFT`, `CLOTH_DRIFT_MAX_SPEED`             | Random turn rate of slow balls (radians per √second) and the speed above which it is zero                                           |
| `CORNER_MOUTH`, `SIDE_MOUTH`                       | Half-width of the corner and side pocket mouths                                                                                     |
| `SIDE_JAW_SLANT`                                   | How much the side pocket jaws narrow towards the back; more covers the hole's rim                                                   |
| `POCKETS`                                          | Centre and capture radius of each pocket                                                                                            |
| `POCKET_ENTRY_NARROWING`, `POCKET_RIM_RESTITUTION` | How much closer to head-on a full-speed ball must enter a pocket, and the bounce of a ball rejected at the rim                      |
| `SINK_DURATION`                                    | Seconds a potted ball takes to drop out of sight                                                                                    |
| `STRIKE_DURATION`                                  | Seconds of cue-stroke animation before the cue ball moves                                                                           |
| `LAMP_HEIGHT`                                      | Height of the lamp over the table centre; lower it for longer shadows                                                               |

Look and sound settings sit at the top of the module that uses them:

| Constant                               | Where            | Meaning                                                                 |
| -------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `CONTACT_SHADOW`, `LAMP_SHADOW`        | `src/render.js`  | Size, darkness and softness of the two ball shadows                     |
| `FELT_LIGHT`, `FELT_SHADE`             | `src/table.js`   | Lit centre of the felt and the darkening towards the rails              |
| `BEVEL_WIDTH`, `BEVEL_STOPS`           | `src/table.js`   | Width and colours of the lit rubber edge on the cushions                |
| `GRAIN_SEED`, `NOISE_SEED`             | `src/table.js`   | Seeds for the wood grain and felt noise; change for a different pattern |
| `GUIDE_OUTLINE`, `GUIDE_OUTLINE_WIDTH` | `src/overlay.js` | Dark outline around the white aim guide                                 |
| `MASTER_VOLUME`, `FULL_VOLUME_SPEED`   | `src/sound.js`   | Overall volume, and how hard a hit must be to play at full volume       |

## Self-test

Open `http://localhost:5173/?test` while `yarn dev` runs. It simulates 20 full-power breaks without rendering (each on a freshly randomised rack and with random collision order, so runs differ) and checks that energy never rises, every ball comes to rest, no ball is lost or leaves the table, and no balls overlap. The result appears in the page title and the console as `TEST PASS` or `TEST FAIL: <reason>`.

## Known limits

- If the browser drops the WebGL context, reload the page.
- The 6 and 9 have no underline; tell them apart by solid versus stripe.
- The player cannot choose spin yet: every shot is a centre hit, and side spin only comes from cushion and ball–ball friction. The cushion touches the ball at its equator, so it never changes top or back spin. `fire` in `src/rules.js` is where a cue-tip offset would set the cue ball's starting spin.
