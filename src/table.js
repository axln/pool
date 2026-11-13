// The table, drawn once per resize on an offscreen 2D canvas: frame, castings, felt, pockets and cushions.
import {
    PLAY_WIDTH, PLAY_HEIGHT, CUSHION_DEPTH, FRAME_WIDTH, TABLE_WIDTH, TABLE_HEIGHT, POCKETS, CUSHIONS,
} from './constants.js';

const FULL_TURN = 2 * Math.PI;
const FRAME_CORNER_RADIUS = 28;
const WOOD_STOPS = [[0, '#8f3426'], [0.5, '#5c1c15'], [1, '#7e2a1f']];
const GRAIN_LINES = 80;
const GRAIN_STYLE = 'rgba(0,0,0,.13)';
const GRAIN_WIDTH = 0.8;
const GRAIN_WAVE = 12;
const GRAIN_END_WAVE = 6;
const METAL_STOPS = [[0, '#f6f8fa'], [0.45, '#98a2ad'], [0.6, '#e4e8ec'], [1, '#6c7580']];
const PLATE_SIZE = 78;
const PLATE_RADIUS = 12;
const CORNER_PLATES = [
    [-FRAME_WIDTH, -FRAME_WIDTH], [PLAY_WIDTH + FRAME_WIDTH - PLATE_SIZE, -FRAME_WIDTH],
    [-FRAME_WIDTH, PLAY_HEIGHT + FRAME_WIDTH - PLATE_SIZE], [PLAY_WIDTH + FRAME_WIDTH - PLATE_SIZE, PLAY_HEIGHT + FRAME_WIDTH - PLATE_SIZE],
];
const SIDE_CASTING_HALF_WIDTH = 38;
const SIDE_CASTING_OVERHANG = 6;
const SIDE_CASTING_RADIUS = 8;
const POCKET_BACKING = 22; // casting square behind each corner pocket
const SIGHT_RADIUS = 2.6;
const SIGHT_OFFSET = 17; // from the cushion back into the rail
const SIGHT_COLOR = '#e3e9f7';
const FELT_COLOR = '#2f80ba';
const NOISE_SIZE = 128;
const NOISE_MAX_ALPHA = 26;
const FELT_LIGHT_REACH = 0.62; // of the playfield width
const FELT_LIGHT_STOPS = [[0, 'rgba(165,225,255,.42)'], [0.55, 'rgba(120,190,240,0)'], [1, 'rgba(3,18,48,.45)']];
const POCKET_STOPS = [[0, '#000'], [0.75, '#070707'], [1, '#2b2b2b']];
const CUSHION_STOPS = [[0, '#a5dcfa'], [0.2, '#62b0e4'], [0.3, '#4494d0'], [1, '#2f78b3']];
const CUSHION_SHADOW_COLOR = 'rgba(0,12,36,.6)';
const CUSHION_SHADOW_BLUR = 10;

export function drawTable(scale) {
    const canvas = createCanvas(TABLE_WIDTH * scale, TABLE_HEIGHT * scale), context = canvas.getContext('2d');
    context.setTransform(scale, 0, 0, scale, FRAME_WIDTH * scale, FRAME_WIDTH * scale);
    drawFrame(context);
    drawSights(context);
    drawFelt(context);
    drawMarkings(context);
    drawPockets(context);
    drawCushions(context, scale);
    return canvas;
}

// wood frame with grain and metal castings, all clipped to the rounded outline
function drawFrame(context) {
    context.beginPath();
    context.roundRect(-FRAME_WIDTH, -FRAME_WIDTH, TABLE_WIDTH, TABLE_HEIGHT, FRAME_CORNER_RADIUS);
    context.fillStyle = gradient(context.createLinearGradient(0, -FRAME_WIDTH, 0, PLAY_HEIGHT + FRAME_WIDTH), WOOD_STOPS);
    context.fill();
    context.save();
    context.clip();
    drawWoodGrain(context);
    drawCornerPlates(context);
    drawSideCastings(context);
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,.14)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(-FRAME_WIDTH + 1, -FRAME_WIDTH + 1, TABLE_WIDTH - 2, TABLE_HEIGHT - 2, FRAME_CORNER_RADIUS - 1);
    context.stroke();
}

function drawWoodGrain(context) {
    context.strokeStyle = GRAIN_STYLE;
    context.lineWidth = GRAIN_WIDTH;
    for (let line = 0; line < GRAIN_LINES; line++) {
        const y = -FRAME_WIDTH + Math.random() * TABLE_HEIGHT;
        context.beginPath();
        context.moveTo(-FRAME_WIDTH, y);
        context.bezierCurveTo(PLAY_WIDTH * 0.3, y + jitter(GRAIN_WAVE), PLAY_WIDTH * 0.7, y + jitter(GRAIN_WAVE),
            PLAY_WIDTH + FRAME_WIDTH, y + jitter(GRAIN_END_WAVE));
        context.stroke();
    }
}

function jitter(amount) {
    return (Math.random() - 0.5) * amount;
}

function drawCornerPlates(context) {
    for (const [x, y] of CORNER_PLATES) {
        context.fillStyle = metalGradient(context, x, y, x + PLATE_SIZE, y + PLATE_SIZE);
        context.beginPath();
        context.roundRect(x, y, PLATE_SIZE, PLATE_SIZE, PLATE_RADIUS);
        context.fill();
    }
}

function drawSideCastings(context) {
    const left = PLAY_WIDTH / 2 - SIDE_CASTING_HALF_WIDTH, railDepth = FRAME_WIDTH - CUSHION_DEPTH;
    for (const y of [-FRAME_WIDTH, PLAY_HEIGHT + CUSHION_DEPTH]) {
        context.fillStyle = metalGradient(context, left, y, PLAY_WIDTH / 2 + SIDE_CASTING_HALF_WIDTH, y + railDepth);
        context.beginPath();
        context.roundRect(left, y - SIDE_CASTING_OVERHANG, 2 * SIDE_CASTING_HALF_WIDTH,
            railDepth + 2 * SIDE_CASTING_OVERHANG, SIDE_CASTING_RADIUS);
        context.fill();
    }
}

// diamonds on the rails: three per half-length, three across
function drawSights(context) {
    context.fillStyle = SIGHT_COLOR;
    const railOffset = CUSHION_DEPTH + SIGHT_OFFSET;
    for (const eighth of [1, 2, 3, 5, 6, 7]) {
        drawDot(context, PLAY_WIDTH * eighth / 8, -railOffset, SIGHT_RADIUS);
        drawDot(context, PLAY_WIDTH * eighth / 8, PLAY_HEIGHT + railOffset, SIGHT_RADIUS);
    }
    for (const quarter of [1, 2, 3]) {
        drawDot(context, -railOffset, PLAY_HEIGHT * quarter / 4, SIGHT_RADIUS);
        drawDot(context, PLAY_WIDTH + railOffset, PLAY_HEIGHT * quarter / 4, SIGHT_RADIUS);
    }
}

// felt: base colour, grain noise, a lit centre that darkens towards the rails
function drawFelt(context) {
    const x = -CUSHION_DEPTH, y = -CUSHION_DEPTH, width = PLAY_WIDTH + 2 * CUSHION_DEPTH, height = PLAY_HEIGHT + 2 * CUSHION_DEPTH;
    context.fillStyle = FELT_COLOR;
    context.fillRect(x, y, width, height);
    context.fillStyle = context.createPattern(createNoise(), 'repeat');
    context.fillRect(x, y, width, height);
    const centerX = PLAY_WIDTH / 2, centerY = PLAY_HEIGHT / 2;
    context.fillStyle = gradient(context.createRadialGradient(centerX, centerY, 0, centerX, centerY, PLAY_WIDTH * FELT_LIGHT_REACH), FELT_LIGHT_STOPS);
    context.fillRect(x, y, width, height);
    drawPocketBacking(context);
}

function createNoise() {
    const canvas = createCanvas(NOISE_SIZE, NOISE_SIZE), context = canvas.getContext('2d');
    const image = context.createImageData(NOISE_SIZE, NOISE_SIZE);
    for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.random() < 0.5 ? 0 : 255;
        image.data[i + 3] = Math.random() * NOISE_MAX_ALPHA;
    }
    context.putImageData(image, 0, 0);
    return canvas;
}

export function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    return canvas;
}

// the casting wraps behind each corner pocket, so no felt shows past the hole
function drawPocketBacking(context) {
    for (const [x, y] of CORNER_PLATES) {
        context.fillStyle = metalGradient(context, x, y, x + PLATE_SIZE, y + PLATE_SIZE);
        context.fillRect(x < 0 ? -CUSHION_DEPTH : PLAY_WIDTH + CUSHION_DEPTH - POCKET_BACKING,
            y < 0 ? -CUSHION_DEPTH : PLAY_HEIGHT + CUSHION_DEPTH - POCKET_BACKING, POCKET_BACKING, POCKET_BACKING);
    }
}

function metalGradient(context, startX, startY, endX, endY) {
    return gradient(context.createLinearGradient(startX, startY, endX, endY), METAL_STOPS);
}

// head string, foot spot and head spot
function drawMarkings(context) {
    context.strokeStyle = 'rgba(190,230,255,.5)';
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(PLAY_WIDTH / 4, 0);
    context.lineTo(PLAY_WIDTH / 4, PLAY_HEIGHT);
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.75)';
    drawDot(context, PLAY_WIDTH * 0.75, PLAY_HEIGHT / 2, 3);
    drawDot(context, PLAY_WIDTH / 4, PLAY_HEIGHT / 2, 2);
}

function drawDot(context, x, y, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, FULL_TURN);
    context.fill();
}

function drawPockets(context) {
    for (const pocket of POCKETS) {
        const radius = pocket.radius;
        context.fillStyle = gradient(context.createRadialGradient(pocket.x, pocket.y, radius * 0.3, pocket.x, pocket.y, radius), POCKET_STOPS);
        context.beginPath();
        context.arc(pocket.x, pocket.y, radius, 0, FULL_TURN);
        context.fill();
        context.strokeStyle = 'rgba(0,0,0,.7)';
        context.lineWidth = 1.5;
        context.stroke();
    }
}

// raised cushions: all shadows first, then the bodies, so no shadow falls on a neighbouring cushion
function drawCushions(context, scale) {
    for (const polygon of CUSHIONS) drawCushionShadow(context, polygon, scale);
    for (const polygon of CUSHIONS) drawCushionBody(context, polygon);
}

// clipped to the playfield so the pocket mouths stay clean felt
function drawCushionShadow(context, polygon, scale) {
    context.save();
    context.beginPath();
    context.rect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
    context.clip();
    context.shadowColor = CUSHION_SHADOW_COLOR;
    context.shadowBlur = CUSHION_SHADOW_BLUR * scale; // shadowBlur is in device px
    fillCushion(context, polygon);
    context.restore();
}

// bright bevel at the nose, darker towards the back, edged on both long sides
function drawCushionBody(context, polygon) {
    context.save();
    fillCushion(context, polygon);
    context.restore();
    context.lineWidth = 1;
    context.lineCap = 'round';
    strokeLine(context, polygon[1], polygon[2], 'rgba(255,255,255,.55)');
    strokeLine(context, polygon[0], polygon[3], 'rgba(0,10,30,.4)');
}

function fillCushion(context, polygon) {
    const [, noseStart] = polygon, horizontal = polygon[1][1] === polygon[2][1];
    const towardsBack = horizontal ? Math.sign(polygon[0][1] - noseStart[1]) : Math.sign(polygon[0][0] - noseStart[0]);
    const bevel = horizontal
        ? context.createLinearGradient(0, noseStart[1], 0, noseStart[1] + towardsBack * CUSHION_DEPTH)
        : context.createLinearGradient(noseStart[0], 0, noseStart[0] + towardsBack * CUSHION_DEPTH, 0);
    context.fillStyle = gradient(bevel, CUSHION_STOPS);
    context.beginPath();
    polygon.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    context.fill();
}

function gradient(canvasGradient, stops) {
    for (const [offset, color] of stops) canvasGradient.addColorStop(offset, color);
    return canvasGradient;
}

function strokeLine(context, [startX, startY], [endX, endY], color) {
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
}
