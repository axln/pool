// The table, drawn once per resize on an offscreen 2D canvas: frame, castings, felt, pockets and cushions.
import {
    PLAY_WIDTH, PLAY_HEIGHT, CUSHION_DEPTH, FRAME_WIDTH, TABLE_WIDTH, TABLE_HEIGHT, POCKETS, CUSHIONS,
} from './constants.js';

const FULL_TURN = 2 * Math.PI;
const FRAME_CORNER_RADIUS = 28;
const WOOD_STOPS = [[0, '#8f3426'], [0.5, '#5c1c15'], [1, '#7e2a1f']];
const GRAIN_LINES = 80;
const GRAIN_SEED = 1; // fixed seeds: the table looks the same on every load and resize
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
const NOISE_SEED = 2;
const FELT_LIGHT_REACH = 0.62; // of the playfield width
const FELT_LIGHT_STOPS = [[0, 'rgba(165,225,255,.42)'], [0.55, 'rgba(120,190,240,0)'], [1, 'rgba(3,18,48,.45)']];
const POCKET_STOPS = [[0, '#000'], [0.75, '#070707'], [1, '#2b2b2b']];
const CUSHION_STOPS = [[0, '#a5dcfa'], [0.2, '#62b0e4'], [0.3, '#4494d0'], [1, '#2f78b3']];
const BEVEL_WIDTH = 0.3 * CUSHION_DEPTH; // lit rubber strip along the nose and both jaws
const BEVEL_STOPS = [[0, '#a5dcfa'], [0.67, '#62b0e4'], [1, '#4494d0']];
const CUSHION_EDGES = 4; // polygon edges: jaw, nose, jaw, back
const BACK_EDGE = 3;
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
    const random = createRandom(GRAIN_SEED);
    context.strokeStyle = GRAIN_STYLE;
    context.lineWidth = GRAIN_WIDTH;
    for (let line = 0; line < GRAIN_LINES; line++) {
        const y = -FRAME_WIDTH + random() * TABLE_HEIGHT;
        context.beginPath();
        context.moveTo(-FRAME_WIDTH, y);
        context.bezierCurveTo(PLAY_WIDTH * 0.3, y + jitter(random, GRAIN_WAVE), PLAY_WIDTH * 0.7, y + jitter(random, GRAIN_WAVE),
            PLAY_WIDTH + FRAME_WIDTH, y + jitter(random, GRAIN_END_WAVE));
        context.stroke();
    }
}

function jitter(random, amount) {
    return (random() - 0.5) * amount;
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
    const image = context.createImageData(NOISE_SIZE, NOISE_SIZE), random = createRandom(NOISE_SEED);
    for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = image.data[i + 1] = image.data[i + 2] = random() < 0.5 ? 0 : 255;
        image.data[i + 3] = random() * NOISE_MAX_ALPHA;
    }
    context.putImageData(image, 0, 0);
    return canvas;
}

// mulberry32: a tiny seeded generator, returns floats in [0, 1)
function createRandom(seed) {
    let state = seed;
    return function random() {
        state = state + 0x6d2b79f5 | 0;
        let mixed = Math.imul(state ^ state >>> 15, 1 | state);
        mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
        return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
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

// head string and head spot; the foot spot is deliberately unmarked
function drawMarkings(context) {
    context.strokeStyle = 'rgba(190,230,255,.5)';
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(PLAY_WIDTH / 4, 0);
    context.lineTo(PLAY_WIDTH / 4, PLAY_HEIGHT);
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.75)';
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

// the rubber body, then a lit bevel along the nose and both jaws, mitred so the highlight wraps around each corner
function drawCushionBody(context, polygon) {
    const normals = polygon.map((point, edge) => inwardNormal(polygon, edge));
    const inner = insetPolygon(polygon, normals);
    context.save();
    fillCushion(context, polygon);
    context.restore();
    for (let edge = 0; edge < BACK_EDGE; edge++) fillBevel(context, polygon, inner, normals[edge], edge);
    context.lineWidth = 1;
    context.lineCap = context.lineJoin = 'round';
    strokePolyline(context, polygon, 'rgba(255,255,255,.55)');
    strokeLine(context, polygon[0], polygon[3], 'rgba(0,10,30,.4)');
}

function inwardNormal(polygon, edge) {
    const [startX, startY] = polygon[edge], [endX, endY] = polygon[(edge + 1) % CUSHION_EDGES];
    const length = Math.hypot(endX - startX, endY - startY);
    let normalX = -(endY - startY) / length, normalY = (endX - startX) / length;
    const centerX = polygon.reduce((sum, [x]) => sum + x, 0) / CUSHION_EDGES;
    const centerY = polygon.reduce((sum, [, y]) => sum + y, 0) / CUSHION_EDGES;
    if (normalX * (centerX - startX) + normalY * (centerY - startY) < 0) {
        normalX = -normalX;
        normalY = -normalY;
    }
    return [normalX, normalY];
}

// inner corner of the bevel at each vertex: where the two neighbouring edges, moved inward, cross
function insetPolygon(polygon, normals) {
    return polygon.map((point, vertex) => {
        const previous = (vertex + CUSHION_EDGES - 1) % CUSHION_EDGES;
        return intersectLines(shiftedEdge(polygon, normals, previous), shiftedEdge(polygon, normals, vertex));
    });
}

// the back edge stays put; the others move inward by the bevel width
function shiftedEdge(polygon, normals, edge) {
    const shift = edge === BACK_EDGE ? 0 : BEVEL_WIDTH, [normalX, normalY] = normals[edge];
    const [startX, startY] = polygon[edge], [endX, endY] = polygon[(edge + 1) % CUSHION_EDGES];
    return { x: startX + normalX * shift, y: startY + normalY * shift, dx: endX - startX, dy: endY - startY };
}

function intersectLines(first, second) {
    const along = ((second.x - first.x) * second.dy - (second.y - first.y) * second.dx) / (first.dx * second.dy - first.dy * second.dx);
    return [first.x + first.dx * along, first.y + first.dy * along];
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

// shaded across the strip, from the bright edge inward, whatever the edge's angle
function fillBevel(context, polygon, inner, [normalX, normalY], edge) {
    const next = (edge + 1) % CUSHION_EDGES, [startX, startY] = polygon[edge];
    context.fillStyle = gradient(context.createLinearGradient(startX, startY,
        startX + normalX * BEVEL_WIDTH, startY + normalY * BEVEL_WIDTH), BEVEL_STOPS);
    context.beginPath();
    for (const [x, y] of [polygon[edge], polygon[next], inner[next], inner[edge]]) context.lineTo(x, y);
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

// the highlight runs along the jaw, the nose and the other jaw in one stroke, so the corners join smoothly
function strokePolyline(context, points, color) {
    context.strokeStyle = color;
    context.beginPath();
    for (const [x, y] of points) context.lineTo(x, y);
    context.stroke();
}
