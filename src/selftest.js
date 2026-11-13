// Headless physics check: full-power breaks must lose no energy, stop, keep every ball and leave no overlaps.
import {
  PLAY_WIDTH,
  PLAY_HEIGHT,
  BALL_RADIUS,
  MAX_SHOT_SPEED,
} from "./constants.js";
import { createGame, findCueBall } from "./game.js";
import { step } from "./physics.js";

const BREAK_COUNT = 20;
const BREAK_ANGLE_SPREAD = 0.02;
const TIME_STEP = 1 / 120;
const MAX_STEPS = 120 * 60;
const TOTAL_BALLS = 16;
const POSITION_TOLERANCE = 2;
const OVERLAP_TOLERANCE = 0.5;

export function runSelfTest() {
  for (let breakIndex = 0; breakIndex < BREAK_COUNT; breakIndex++) {
    const game = createGame();
    shootBreak(game, (breakIndex - BREAK_COUNT / 2) * BREAK_ANGLE_SPREAD);
    simulateUntilRest(game, breakIndex);
    checkNoBallLost(game, breakIndex);
    checkBallsOnTable(game, breakIndex);
  }
}

function shootBreak(game, angle) {
  const cueBall = findCueBall(game);
  cueBall.vx = Math.cos(angle) * MAX_SHOT_SPEED;
  cueBall.vy = Math.sin(angle) * MAX_SHOT_SPEED;
}

function simulateUntilRest(game, breakIndex) {
  let energy = Infinity,
    steps = 0;
  do {
    step(game, TIME_STEP);
    const nextEnergy = game.balls.reduce(
      (sum, ball) => sum + ball.vx * ball.vx + ball.vy * ball.vy,
      0,
    );
    if (!(nextEnergy <= energy * (1 + 1e-9) + 1e-6))
      fail(`energy rose or NaN (break ${breakIndex}, step ${steps})`);
    energy = nextEnergy;
    if (++steps > MAX_STEPS) fail(`balls never stopped (break ${breakIndex})`);
  } while (energy > 0);
}

function checkNoBallLost(game, breakIndex) {
  if (
    game.balls.length + game.potted.length + (game.scratch ? 1 : 0) !==
    TOTAL_BALLS
  )
    fail(`ball lost (break ${breakIndex})`);
}

function checkBallsOnTable(game, breakIndex) {
  const balls = game.balls;
  balls.forEach((ball, i) => {
    if (
      ball.x < -POSITION_TOLERANCE ||
      ball.x > PLAY_WIDTH + POSITION_TOLERANCE ||
      ball.y < -POSITION_TOLERANCE ||
      ball.y > PLAY_HEIGHT + POSITION_TOLERANCE
    ) {
      fail(`ball ${ball.number} off table (break ${breakIndex})`);
    }
    for (let j = i + 1; j < balls.length; j++) {
      if (
        Math.hypot(ball.x - balls[j].x, ball.y - balls[j].y) <
        2 * BALL_RADIUS - OVERLAP_TOLERANCE
      ) {
        fail(`balls overlap (break ${breakIndex})`);
      }
    }
  });
}

function fail(message) {
  throw new Error(message);
}
