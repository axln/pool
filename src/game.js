// Game state: creating it, racking, and queries other modules share.
import { PLAY_WIDTH, PLAY_HEIGHT, BALL_RADIUS } from "./constants.js";

const RACK_ORDER = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 6, 13, 14, 7, 15]; // 8 centre, back corners differ
const RACK_ROWS = 5;
const RACK_SPACING = 2 * BALL_RADIUS + 0.3; // a hair apart, so the rack does not start in contact
const HEAD_SPOT = { x: PLAY_WIDTH / 4, y: PLAY_HEIGHT / 2 };
const FOOT_SPOT = { x: PLAY_WIDTH * 0.75, y: PLAY_HEIGHT / 2 };

export function createGame() {
  const game = { shotPower: 0, strikeTime: 0, hover: null }; // rack sets the rest
  rack(game);
  return game;
}

export function rack(game) {
  const balls = [createBall(0, HEAD_SPOT.x, HEAD_SPOT.y)];
  for (let row = 0, index = 0; row < RACK_ROWS; row++) {
    for (let place = 0; place <= row; place++, index++) {
      const x = FOOT_SPOT.x + (row * RACK_SPACING * Math.sqrt(3)) / 2;
      const y = FOOT_SPOT.y + (place - row / 2) * RACK_SPACING;
      balls.push(createBall(RACK_ORDER[index], x, y));
    }
  }
  Object.assign(game, {
    balls,
    sinking: [],
    potted: [],
    player: 1,
    state: "aim",
    inHand: false,
    handPlaced: false,
    power: 0,
    potsThisShot: 0,
    scratch: false,
    message: "",
    drag: null,
    aim: 0,
    events: [],
  });
}

export function createBall(number, x, y) {
  return {
    number,
    x,
    y,
    vx: 0,
    vy: 0,
    orientation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };
}

export function findCueBall(game) {
  return game.balls.find((ball) => ball.number === 0);
}

// the cue ball itself never blocks its own new spot
export function isFreeSpot(game, x, y) {
  return game.balls.every(
    (ball) =>
      ball.number === 0 ||
      Math.hypot(ball.x - x, ball.y - y) >= 2 * BALL_RADIUS,
  );
}
