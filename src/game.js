// Game state: creating it, racking, and queries other modules share.
import { PLAY_WIDTH, PLAY_HEIGHT, BALL_RADIUS, shuffled } from "./constants.js";

const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const EIGHT_BALL_PLACE = 4; // centre of the triangle
const BACK_CORNER_PLACES = [10, 14]; // one solid and one stripe, as in the rules
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
    const rackOrder = createRackOrder();
    const balls = [createBall(0, HEAD_SPOT.x, HEAD_SPOT.y)];
    for (let row = 0, index = 0; row < RACK_ROWS; row++) {
        for (let place = 0; place <= row; place++, index++) {
            const x = FOOT_SPOT.x + (row * RACK_SPACING * Math.sqrt(3)) / 2;
            const y = FOOT_SPOT.y + (place - row / 2) * RACK_SPACING;
            balls.push(createBall(rackOrder[index], x, y));
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
        shotPotted: [],
        groups: { 1: null, 2: null },
        announcement: null,
        scratch: false,
        message: "",
        drag: null,
        aim: 0,
        events: [],
    });
}

// 8 in the centre, a solid and a stripe in the back corners, the rest random
function createRackOrder() {
    const [solid, ...otherSolids] = shuffled(SOLIDS),
        [stripe, ...otherStripes] = shuffled(STRIPES);
    const [firstCorner, secondCorner] = shuffled([solid, stripe]);
    const order = shuffled([...otherSolids, ...otherStripes]);
    order.splice(EIGHT_BALL_PLACE, 0, 8);
    order.splice(BACK_CORNER_PLACES[0], 0, firstCorner);
    order.splice(BACK_CORNER_PLACES[1], 0, secondCorner);
    return order;
}

export function createBall(number, x, y) {
    return {
        number,
        x,
        y,
        vx: 0,
        vy: 0,
        wx: 0, // spin about the horizontal axes in rad/s; rolling is wy = vx / R, wx = -vy / R
        wy: 0,
        wz: 0, // side spin about the vertical axis
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
