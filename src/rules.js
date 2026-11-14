// What happens when a shot starts and when every ball has stopped.
import {
  PLAY_WIDTH,
  PLAY_HEIGHT,
  BALL_RADIUS,
  MAX_SHOT_SPEED,
} from "./constants.js";
import { createBall, findCueBall, isFreeSpot } from "./game.js";

const BALL_COUNT = 15;

export function fire(game) {
  const cueBall = findCueBall(game);
  cueBall.vx = Math.cos(game.aim) * MAX_SHOT_SPEED * game.shotPower;
  cueBall.vy = Math.sin(game.aim) * MAX_SHOT_SPEED * game.shotPower;
  Object.assign(game, {
    potsThisShot: 0,
    scratch: false,
    inHand: false,
    state: "moving",
  });
  game.events.push({ type: "cue", speed: game.shotPower });
}

export function settle(game) {
  if (game.potted.includes(8)) {
    endRack(game);
    return;
  }
  if (game.scratch) respotCueBall(game);
  if (game.scratch || !game.potsThisShot) game.player = 3 - game.player;
  game.state = "aim";
}

function endRack(game) {
  const won = game.potted.length === BALL_COUNT && !game.scratch;
  game.state = "over";
  game.message = won
    ? `Table cleared — Player ${game.player} wins!`
    : `8-ball foul — Player ${game.player} loses`;
}

// back on the head string, stepping alternately down and up until the spot is free
function respotCueBall(game) {
  const x = PLAY_WIDTH / 4;
  let y = PLAY_HEIGHT / 2;
  for (let attempt = 1; !isFreeSpot(game, x, y); attempt++) {
    y =
      PLAY_HEIGHT / 2 +
      (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * BALL_RADIUS;
  }
  game.balls.push(createBall(0, x, y));
  game.inHand = true;
  game.handPlaced = false;
}
