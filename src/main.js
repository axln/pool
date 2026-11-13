// Entry point: optional self-test, then the frame loop driven by the display refresh.
import { STRIKE_DURATION } from "./constants.js";
import { createGame } from "./game.js";
import { step, animateSinking } from "./physics.js";
import { fire, settle } from "./rules.js";
import { runSelfTest } from "./selftest.js";
import { layout } from "./view.js";
import { createRenderer, uploadTable } from "./gl.js";
import { render } from "./render.js";
import { bindInput, aimAt } from "./input.js";
import { createSound, unlockSound, playSounds } from "./sound.js";

const MAX_FRAME_TIME = 0.05; // longer gaps (a background tab) slow the game down instead of jumping the balls

// returns the app state, or null without WebGL; headless checks use the return value
export function main() {
  if (location.search.includes("test")) reportSelfTest();
  const canvases = {
    webgl: document.getElementById("gl"),
    overlay: document.getElementById("cv"),
  };
  // shortcut: no webglcontextlost handling, reload the page if the GPU context is ever dropped
  const renderer = createRenderer(canvases.webgl);
  if (!renderer) {
    document.body.textContent = "This game needs WebGL.";
    return null;
  }
  const app = {
    game: createGame(),
    view: null,
    renderer,
    overlay: canvases.overlay.getContext("2d"),
    canvases,
    lastTime: 0,
    sound: createSound(),
  };
  resize(app);
  bindInput(app);
  addEventListener("pointerdown", () => unlockSound(app.sound)); // browsers only allow audio after a user gesture
  addEventListener("resize", () => resize(app));
  requestAnimationFrame((time) => frame(app, time));
  return app;
}

function reportSelfTest() {
  try {
    runSelfTest();
    document.title = "TEST PASS";
  } catch (error) {
    document.title = "TEST FAIL: " + error.message;
  }
  console.log(document.title);
}

function resize(app) {
  app.view = layout(app.canvases);
  uploadTable(app.renderer, app.view);
}

function frame(app, time) {
  const dt = Math.min(MAX_FRAME_TIME, (time - app.lastTime) / 1000);
  app.lastTime = time;
  advance(app.game, dt);
  playSounds(app.sound, app.game.events);
  app.game.events = [];
  render(app.renderer, app.overlay, app.view, app.game);
  requestAnimationFrame((next) => frame(app, next));
}

// order matters: a stroke that ends this frame already moves, and a shot that settles can be re-aimed at once
function advance(game, dt) {
  if (game.state === "strike" && (game.strikeTime += dt) >= STRIKE_DURATION)
    fire(game);
  if (game.state === "moving") step(game, dt); // one step per displayed frame (sub-stepped inside): no beat against the refresh rate
  animateSinking(game, dt);
  if (
    game.state === "moving" &&
    !game.sinking.length &&
    game.balls.every((ball) => !ball.vx && !ball.vy)
  )
    settle(game);
  if (game.state === "aim" && !game.drag && game.hover) aimAt(game, game.hover);
}
