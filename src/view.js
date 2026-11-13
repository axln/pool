// Fits the table to the window: one scale and offset from world units to CSS pixels.
import { PLAY_WIDTH, PLAY_HEIGHT, FRAME_WIDTH, TABLE_WIDTH, TABLE_HEIGHT } from './constants.js';

const LEFT_MARGIN = 84; // room for the power slider
const TOP_MARGIN = 64; // room for the HUD bar
const EDGE_MARGIN = 14;
const MIN_SCALE = 0.1;
const SLIDER_GAP = 52;
const SLIDER_WIDTH = 22;
const SLIDER_TOP = 0.1; // slider spans the middle 80% of the playfield height
const SLIDER_LENGTH = 0.8;
export const HUD_BALL_RADIUS = 12;
const HUD_ABOVE_FRAME = 34;
const HUD_END_INSET = 26;
const HUD_BALL_GAP = 6;

// sizes both canvases to the window and returns the new view
export function layout(canvases) {
    const pixelRatio = window.devicePixelRatio || 1, width = innerWidth, height = innerHeight;
    for (const canvas of [canvases.overlay, canvases.webgl]) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
    }
    const scale = Math.max(MIN_SCALE, Math.min(
        (width - LEFT_MARGIN - EDGE_MARGIN) / TABLE_WIDTH, (height - TOP_MARGIN - EDGE_MARGIN) / TABLE_HEIGHT));
    const originX = LEFT_MARGIN + (width - LEFT_MARGIN - EDGE_MARGIN - TABLE_WIDTH * scale) / 2 + FRAME_WIDTH * scale;
    const originY = TOP_MARGIN + (height - TOP_MARGIN - EDGE_MARGIN - TABLE_HEIGHT * scale) / 2 + FRAME_WIDTH * scale;
    const slider = {
        x: originX - FRAME_WIDTH * scale - SLIDER_GAP, y: originY + PLAY_HEIGHT * scale * SLIDER_TOP,
        width: SLIDER_WIDTH, height: PLAY_HEIGHT * scale * SLIDER_LENGTH,
    };
    return { pixelRatio, width, height, scale, originX, originY, slider };
}

export function toScreenX(view, x) {
    return view.originX + x * view.scale;
}

export function toScreenY(view, y) {
    return view.originY + y * view.scale;
}

// HUD rack of potted balls: solids on the left, stripes on the right
export function hudBallX(view, number) {
    const spacing = 2 * HUD_BALL_RADIUS + HUD_BALL_GAP;
    return number < 8
        ? view.originX - FRAME_WIDTH * view.scale + HUD_END_INSET + (number - 1) * spacing
        : view.originX + (PLAY_WIDTH + FRAME_WIDTH) * view.scale - HUD_END_INSET - (15 - number) * spacing;
}

export function hudY(view) {
    return view.originY - FRAME_WIDTH * view.scale - HUD_ABOVE_FRAME;
}
