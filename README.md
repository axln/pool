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

## Controls

| Action                             | Mouse                                           | Touch                               |
| ---------------------------------- | ----------------------------------------------- | ----------------------------------- |
| Aim                                | Move the pointer around the cue ball            | Drag on the table                   |
| Shoot                              | Press, drag backward, release                   | Drag the power slider down, release |
| Shoot (alternative)                | Drag the power slider on the left down, release |                                     |
| Place the cue ball after a scratch | Drag the cue ball                               | Drag the cue ball                   |
| New rack                           | `Reset Rack` button, bottom-right               | Same                                |

The bottom-left corner shows the frame rate and, as `worst`, the rate the slowest frame of each half second would give if every frame were that slow, so single hitches show up.

Aim is locked while you pull back with the mouse. A pull shorter than 3% power cancels the shot.

## Rules

The rules are deliberately light, for self-play:

- Standard triangle rack, 8-ball in the centre, cue ball on the head string.
- The top bar shows whose turn it is. The turn passes when a shot pots nothing or scratches; otherwise the same player shoots again.
- Scratch: the cue ball returns to the head string and can be dragged to any free spot before the next shot.
- Potting the 8-ball ends the rack: a win if the other 14 balls are already down and the shot was not a scratch, a loss otherwise. Click to rack again.
- Potted solids collect on the left of the top bar, stripes on the right.

Not implemented: solids/stripes group enforcement, call-pocket, break fouls, spin (english).

## How it works

`index.html` holds the markup and CSS and loads `src/main.js`. The JavaScript is split into small ES modules, one responsibility each; see the table in `CLAUDE.md`.

**Coordinates.** The playfield is 1000 × 500 world units with the origin at its top-left; the ball radius is 11.25 (regulation ratio). `layout()` computes one scale and offset to fit the window, and re-runs on resize.

**Physics** (`step`)

- Runs once per displayed frame and is split into sub-steps so no ball moves more than 0.4 radius per sub-step. This prevents tunneling on the break.
- Ball–ball: equal-mass impulse along the contact normal (restitution 0.96) plus position correction.
- Cushions: 18 line segments (6 noses and their angled pocket jaws), circle-vs-segment collision, restitution 0.75.
- Friction: speed-proportional drag plus a constant rolling deceleration, so balls slow smoothly and stop completely.
- Pockets: a ball is potted when its centre comes within the pocket's capture radius.
- Rolling: each ball carries a 3 × 3 orientation matrix, rotated about the axis square to its travel (`rollBall`).

**Rendering** uses two stacked canvases.

- WebGL (below): the table, ball shadows and balls. The table is drawn procedurally once per resize on an offscreen 2D canvas (`drawTable`) and uploaded as a texture. Its wood grain and felt noise come from fixed seeds, so it looks the same on every load. Each cushion has a lit rubber bevel along its nose and both pocket jaws. The felt shows the head string and head spot; the foot spot is left unmarked so the rack area stays clean. Each ball is a quad whose fragment shader ray-casts a sphere, maps the stripe, number spot and cue-ball dot through the ball's orientation, and applies lighting. Numbers come from a small generated texture atlas. Each ball has two shadows: a tight contact shadow at its edge, and a soft lamp shadow that leans away from the table centre and stretches towards the rails (`CONTACT_SHADOW`, `LAMP_SHADOW` in `src/render.js`).
- 2D canvas (above): HUD, power slider, aim guide (line, ghost ball, deflection lines, with a soft dark outline), cue stick and messages.

**Sound** (`src/sound.js`) plays recorded clips from `public/sounds/`: the "Pool And Billiards SFX" pack by Suraj Kispotta, CC0 (see `public/sounds/CREDITS.md`). Physics records each impact in `game.events` as `{ type, speed }` (`cue`, `ball`, `rail`, `pocket`). Every frame the loudest few are played, each with a random take of its clip, a slight pitch variation, and a volume that follows the impact speed. Browsers allow audio only after a user gesture, so the clips load and the sound starts with the first click or touch.

**Game flow.** `game.state` is one of `aim`, `strike` (cue animation), `moving` or `over`. `settle()` runs when every ball has stopped and applies the rules above.

## Tuning

The constants in `src/constants.js` control the feel:

| Constant                               | Meaning                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `MAX_SHOT_SPEED`                       | Cue-ball speed at full power                                                      |
| `DRAG`, `ROLLING_RESISTANCE`           | Friction: proportional and constant parts                                         |
| `BALL_RESTITUTION`, `RAIL_RESTITUTION` | Restitution for ball–ball and cushion hits                                        |
| `CORNER_MOUTH`, `SIDE_MOUTH`           | Half-width of the corner and side pocket mouths                                   |
| `SIDE_JAW_SLANT`                       | How much the side pocket jaws narrow towards the back; more covers the hole's rim |
| `POCKETS`                              | Centre and capture radius of each pocket                                          |
| `SINK_DURATION`                        | Seconds a potted ball takes to drop out of sight                                  |
| `STRIKE_DURATION`                      | Seconds of cue-stroke animation before the cue ball moves                         |
| `LAMP_HEIGHT`                          | Height of the lamp over the table centre; lower it for longer shadows             |

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

Open `http://localhost:5173/?test` while `yarn dev` runs. It simulates 20 full-power breaks without rendering and checks that energy never rises, every ball comes to rest, no ball is lost or leaves the table, and no balls overlap. The result appears in the page title and the console as `TEST PASS` or `TEST FAIL: <reason>`.

## Known limits

- If the browser drops the WebGL context, reload the page.
- The 6 and 9 have no underline; tell them apart by solid versus stripe.
- Balls roll only in their direction of travel: no side spin, and no skid right after a hit.
