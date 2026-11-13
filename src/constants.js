// Shared geometry and tuning. World units: the playfield is PLAY_WIDTH x PLAY_HEIGHT, origin at its top-left.

export const PLAY_WIDTH = 1000;
export const PLAY_HEIGHT = 500;
export const BALL_RADIUS = 11.25;
export const CUSHION_DEPTH = 18;
export const FRAME_WIDTH = 52;
const CORNER_MOUTH = 34; // half-width of a corner pocket mouth
const SIDE_MOUTH = 24; // half-width of a side pocket mouth
export const TABLE_WIDTH = PLAY_WIDTH + 2 * FRAME_WIDTH;
export const TABLE_HEIGHT = PLAY_HEIGHT + 2 * FRAME_WIDTH;

export const MAX_SHOT_SPEED = 2600;
export const BALL_RESTITUTION = 0.96;
export const RAIL_RESTITUTION = 0.75;
export const DRAG = 0.6;
export const ROLLING_RESISTANCE = 40;
export const SINK_DURATION = 0.5; // seconds a potted ball takes to drop out of sight
export const STRIKE_DURATION = 0.08; // seconds of cue-stroke animation before the ball moves
export const LAMP_HEIGHT = 1200; // lamp height over the table centre; high so edge shadows only lean a little

export const BALL_COLORS = ['#f7f4ea', '#f5c518', '#1e4fc2', '#d8262c', '#5b2a91', '#f07a1a', '#14804a', '#7a1c22', '#141414'];

export const POCKETS = [
    [4, 4, 24], [PLAY_WIDTH / 2, -10, 20], [PLAY_WIDTH - 4, 4, 24],
    [4, PLAY_HEIGHT - 4, 24], [PLAY_WIDTH / 2, PLAY_HEIGHT + 10, 20], [PLAY_WIDTH - 4, PLAY_HEIGHT - 4, 24],
].map(([x, y, radius]) => ({ x, y, radius }));

// cushion polygons: [back-a, nose-a, nose-b, back-b]; the other four are mirrors
const TOP_LEFT_CUSHION = [
    [CORNER_MOUTH - CUSHION_DEPTH, -CUSHION_DEPTH], [CORNER_MOUTH, 0],
    [PLAY_WIDTH / 2 - SIDE_MOUTH, 0], [PLAY_WIDTH / 2 - SIDE_MOUTH + 6, -CUSHION_DEPTH],
];
const LEFT_CUSHION = [
    [-CUSHION_DEPTH, CORNER_MOUTH - CUSHION_DEPTH], [0, CORNER_MOUTH],
    [0, PLAY_HEIGHT - CORNER_MOUTH], [-CUSHION_DEPTH, PLAY_HEIGHT - CORNER_MOUTH + CUSHION_DEPTH],
];
export const CUSHIONS = [
    TOP_LEFT_CUSHION, mirrorX(TOP_LEFT_CUSHION), mirrorY(TOP_LEFT_CUSHION), mirrorY(mirrorX(TOP_LEFT_CUSHION)),
    LEFT_CUSHION, mirrorX(LEFT_CUSHION),
];
export const CUSHION_SEGMENTS = CUSHIONS.flatMap(polygon => [
    [polygon[0], polygon[1]], [polygon[1], polygon[2]], [polygon[2], polygon[3]],
]);

function mirrorX(polygon) {
    return polygon.map(([x, y]) => [PLAY_WIDTH - x, y]);
}

function mirrorY(polygon) {
    return polygon.map(([x, y]) => [x, PLAY_HEIGHT - y]);
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
