# Physics realism plan

Order: 1, 3, 4, then 2, 5, 6, 7. After each item: run the self-test (`TEST PASS`), update `README.md` if tuning constants or behaviour change, commit.

- [x] **1. Speed-dependent rail bounce.** `RAIL_RESTITUTION` is a flat 0.75 in `collideCushions` (`src/physics.js`). Make it fall with impact speed: hard hits return less energy, soft hits more. Keep the value near 0.75 at typical speeds so shots do not change feel much. Add the new tuning constant(s) to `constants.js` and the README tuning table.
- [x] **3. Several ball-ball passes per sub-step.** `collideBalls` gives each pair one impulse per sub-step, so energy crosses the tight rack slowly. Run the pair loop 2-3 times per sub-step (named constant). Check the break still conserves energy (self-test) and no balls overlap.
- [x] **4. Cloth wobble.** A tiny random sideways nudge on slow-moving balls so slow rolls drift off a perfectly straight line. Keep it small, and none at rest or at high speed. Add the constant(s) to `constants.js` and the README tuning table.

- [x] **2. Pocket entry speed and angle.** `findCapturingPocket` captures any ball whose centre reaches the capture radius. Reject or deflect fast or off-line entries so balls can rattle out of the jaws. Needs tuning so pots do not get much harder.
- [x] **5. Cut-shot throw.** A friction impulse along the contact tangent in `collideBalls`, so a cut ball leaves slightly off the contact normal.
- [x] **6. Slide, then roll.** A per-ball spin state (no player spin control yet; `fire` is the hook): balls skid after a hit before they grip the cloth, so follow, stun and draw happen by themselves. `MAX_SHOT_SPEED` raised to 3070 to keep distances. `rollBall` (visual rolling) must use the spin. Also removes the "no skid right after a hit" known limit in the README.
- [x] **7. Side spin and cushion friction.** Spin about the vertical axis (`wz`) and friction at the cushions, both emergent: no player control yet (`fire` is the hook for it).

Frame time (decided, done): `step` gets a smoothed frame time, not the raw one. The raw `requestAnimationFrame` interval, capped at 50 ms, goes through a running average (`FRAME_TIME_SMOOTHING` in `src/main.js`), because timer jitter showed as uneven motion on screen; checked by playing, no stutter. `step` still sub-steps by distance, so results do not depend on the frame rate (a roll-out at 30, 60 and 144 fps and 1/1000 s: same stop time, positions within about 2 units). A fixed timestep was rejected: it brings back beating against the refresh rate unless rendering is interpolated. Items 6 and 7 must keep using this `dt` and stay independent of it.
