// What happens when a shot starts and when every ball has stopped.
import {
    PLAY_WIDTH,
    PLAY_HEIGHT,
    BALL_RADIUS,
    MAX_SHOT_SPEED,
} from "./constants.js";
import { createBall, findCueBall, isFreeSpot } from "./game.js";

const EIGHT_BALL = 8;
const GROUP_BALLS = {
    solids: [1, 2, 3, 4, 5, 6, 7],
    stripes: [9, 10, 11, 12, 13, 14, 15],
};
const OTHER_GROUP = { solids: "stripes", stripes: "solids" };

export function fire(game) {
    const cueBall = findCueBall(game);
    cueBall.vx = Math.cos(game.aim) * MAX_SHOT_SPEED * game.shotPower;
    cueBall.vy = Math.sin(game.aim) * MAX_SHOT_SPEED * game.shotPower;
    // shortcut: always a centre hit (no spin, so the ball skids first), set wx and wy here from a tip offset to add player-controlled spin
    cueBall.wx = 0;
    cueBall.wy = 0;
    Object.assign(game, {
        shotPotted: [],
        scratch: false,
        inHand: false,
        state: "moving",
    });
    game.events.push({ type: "cue", speed: game.shotPower });
}

export function settle(game) {
    if (game.potted.includes(EIGHT_BALL)) {
        endRack(game);
        return;
    }
    if (game.scratch) respotCueBall(game);
    else assignGroups(game);
    if (game.scratch || !pottedOwnBall(game)) game.player = 3 - game.player;
    game.state = "aim";
}

// the first ball potted on an open table decides the shooter's group; the opponent gets the other
function assignGroups(game) {
    const firstPotted = game.shotPotted[0];
    if (!firstPotted || game.groups[game.player]) return;
    const group = GROUP_BALLS.solids.includes(firstPotted)
        ? "solids"
        : "stripes";
    game.groups[game.player] = group;
    game.groups[3 - game.player] = OTHER_GROUP[group];
    game.announcement = { player: game.player, group, age: 0 };
}

function pottedOwnBall(game) {
    const group = game.groups[game.player];
    return game.shotPotted.some((number) =>
        GROUP_BALLS[group]?.includes(number),
    );
}

function endRack(game) {
    const fault = eightBallFault(game);
    game.state = "over";
    game.message = fault
        ? `${fault} — Player ${game.player} loses`
        : `8-ball in — Player ${game.player} wins!`;
}

function eightBallFault(game) {
    if (game.scratch) return "Cue ball potted with the 8-ball";
    if (!hasClearedGroupBeforeShot(game)) return "8-ball potted too early";
    return "";
}

// potting the last group ball and the 8-ball in one shot does not count
function hasClearedGroupBeforeShot(game) {
    const group = GROUP_BALLS[game.groups[game.player]];
    return (
        !!group &&
        group.every(
            (number) =>
                game.potted.includes(number) &&
                !game.shotPotted.includes(number),
        )
    );
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
