# Physics realism plan

Order: 1, 3, 4. After each item: run the self-test (`TEST PASS`), update `README.md` if tuning constants or behaviour change, commit.

- [x] **1. Speed-dependent rail bounce.** `RAIL_RESTITUTION` is a flat 0.75 in `collideCushions` (`src/physics.js`). Make it fall with impact speed: hard hits return less energy, soft hits more. Keep the value near 0.75 at typical speeds so shots do not change feel much. Add the new tuning constant(s) to `constants.js` and the README tuning table.
- [x] **3. Several ball-ball passes per sub-step.** `collideBalls` gives each pair one impulse per sub-step, so energy crosses the tight rack slowly. Run the pair loop 2-3 times per sub-step (named constant). Check the break still conserves energy (self-test) and no balls overlap.
- [x] **4. Cloth wobble.** A tiny random sideways nudge on slow-moving balls so slow rolls drift off a perfectly straight line. Keep it small, and none at rest or at high speed. Add the constant(s) to `constants.js` and the README tuning table.

Later, in this order, after 1, 3 and 4:

- [ ] **2. Pocket entry speed and angle.** `findCapturingPocket` captures any ball whose centre reaches the capture radius. Reject or deflect fast or off-line entries so balls can rattle out of the jaws. Needs tuning so pots do not get much harder.
- [ ] **5. Cut-shot throw.** A friction impulse along the contact tangent in `collideBalls`, so a cut ball leaves slightly off the contact normal.
- [ ] **6. Slide, then roll.** A per-ball spin state: balls skid after a hit before they grip the cloth, enabling stun, draw and follow. `rollBall` (visual rolling) must use the spin. Also removes the "no skid right after a hit" known limit in the README.
- [ ] **7. English and cushion friction.** Side spin and friction against the cushions. Builds on the spin state from item 6.

Decided: `dt` stays variable (real frame time, capped; `step` sub-steps by distance). Measured a roll-out at 30, 60 and 144 fps and 1/1000 s: same stop time, positions within about 2 units. A fixed timestep would bring back beating against the refresh rate unless rendering is interpolated. Timer jitter showed as uneven motion on screen, so the frame time is smoothed (`FRAME_TIME_SMOOTHING` in `src/main.js`); checked by playing, no stutter.
