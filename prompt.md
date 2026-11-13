Create a complete, single-file HTML5/Canvas single-player 8-Ball Pool game inspired by Miniclip's "8 Ball Pool". 

### Core Requirements & Minimalism:
- **Zero Bloat:** No login screens, no coin shops, no AI opponents, no complex menus. Load directly into the table so the player can immediately play against themselves (taking turns or free-play).
- **Single-File Output:** Everything (HTML, CSS, JS, and procedural graphics) must be contained in one clean, runnable `.html` file with zero external dependencies.

### Visual Style & Procedural Graphics (Miniclip 8-Ball Pool Aesthetic):
- **Top-Down 2D Perspective:** Classic overhead view of a regulation 2:1 pool table centered on a dark, clean background.
- **Procedural Table Rendering:** 
  - Rich royal-blue or emerald-green felt with subtle procedural noise/grain texture and a soft radial vignette shadow near the rails.
  - Polished mahogany/dark-wood outer frame with metallic silver/gold corner and side pocket castings.
  - 6 dark pockets with inner depth shading and crisp cushion bevels (angled green/blue rubber bumpers).
  - White head-string line and center foot-spot drawn on the felt.
- **Procedural Balls (16 total):**
  - 1 white cue ball, 7 solids (1-7), 1 black 8-ball, and 7 stripes (9-15).
  - Render each ball procedurally on offscreen canvases or via clipping paths with realistic spherical shading, specular highlights, crisp white number circles, authentic color bands for stripes, and subtle drop shadows onto the felt.
- **Procedural Cue Stick & Aiming UI:**
  - Classic wooden cue stick with a blue chalk tip, white ferrule, brown shaft, and dark decorated butt.
  - Smooth pull-back animation proportional to shot power.
  - Crisp white aiming line from the cue ball to the first point of contact, showing a "ghost ball" circle at impact and short deflection trajectory lines for both the cue ball and target ball.

### Physics & Gameplay Mechanics:
- **2D Rigid-Body Physics:** Accurate elastic ball-to-ball collisions, cushion rebounds with realistic restitution, and linear friction/rolling resistance so balls decelerate smoothly and come to a complete stop.
- **Controls:**
  - Move mouse/touch around the cue ball to aim.
  - Click/touch and drag backward (or use a sleek vertical power slider on the left side, just like Miniclip) to set shot power, and release to shoot.
- **8-Ball Rules (Self-Play):**
  - Standard triangle rack at the start.
  - If the cue ball is pocketed (scratch), allow the player to drag and place the cue ball anywhere on the table ("ball in hand") before taking the next shot.
  - Keep potted balls displayed neatly in a minimal top HUD bar.
  - Include a single subtle "Reset Rack" button in the corner.

Ensure 60 FPS performance using `requestAnimationFrame` and sub-stepped physics calculations to prevent ball tunneling on high-power break shots.

