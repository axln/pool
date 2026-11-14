// One frame: the WebGL layer (table, sinking balls, shadows, balls, potted balls in the HUD), then the 2D overlay.
import {
    PLAY_WIDTH,
    PLAY_HEIGHT,
    BALL_RADIUS,
    TABLE_WIDTH,
    TABLE_HEIGHT,
    SINK_DURATION,
    LAMP_HEIGHT,
    clamp,
} from "./constants.js";
import {
    toScreenX,
    toScreenY,
    HUD_BALL_RADIUS,
    hudBallX,
    hudY,
} from "./view.js";
import {
    IDENTITY,
    clearLayer,
    drawTableQuad,
    drawShadow,
    drawBall,
} from "./gl.js";
import { drawOverlay } from "./overlay.js";

const SINK_SHRINK = 0.28; // a sinking ball ends this much smaller, as it drops away from the camera
const SINK_DARKEN = 0.7;
const SINK_FADE_START = 0.7; // fraction of SINK_DURATION after which the ball fades out
const SINK_FADE_LENGTH = 0.3;
const RIM_CLOSE_SPEED = 2.5; // the pocket rim covers the ball within 1 / RIM_CLOSE_SPEED of the drop
// size in ball radii; falloff is where the fade starts, as a fraction of that size
const CONTACT_SHADOW = { size: 1.2, strength: 0.25, falloff: 0.8 }; // fades out just past the ball's edge
const LAMP_SHADOW = { size: 1.5, strength: 0.4, falloff: 0.3 }; // wide and soft

export function render(renderer, overlay, view, game) {
    clearLayer(renderer);
    drawTableQuad(
        renderer,
        view,
        view.originX + (PLAY_WIDTH * view.scale) / 2,
        view.originY + (PLAY_HEIGHT * view.scale) / 2,
        (TABLE_WIDTH * view.scale) / 2,
        (TABLE_HEIGHT * view.scale) / 2,
    );
    drawSinkingBalls(renderer, view, game.sinking);
    drawShadows(renderer, view, game.balls);
    drawBalls(renderer, view, game.balls);
    drawPottedBalls(renderer, view, game.potted);
    drawOverlay(overlay, view, game);
}

// shrinks, darkens and fades while the pocket rim closes over it
function drawSinkingBalls(renderer, view, sinkingBalls) {
    const { scale, pixelRatio } = view,
        radius = BALL_RADIUS * scale;
    for (const sinking of sinkingBalls) {
        const progress = sinking.time / SINK_DURATION,
            eased = progress * progress * (3 - 2 * progress);
        const pocket = sinking.pocket;
        const rimRadius =
            (pocket.radius -
                1 +
                2 *
                    BALL_RADIUS *
                    (1 - Math.min(1, progress * RIM_CLOSE_SPEED))) *
            scale;
        drawBall(
            renderer,
            view,
            sinking.number,
            sinking.orientation,
            toScreenX(view, sinking.x),
            toScreenY(view, sinking.y),
            radius * (1 - SINK_SHRINK * eased),
            {
                alpha:
                    1 -
                    clamp(
                        (progress - SINK_FADE_START) / SINK_FADE_LENGTH,
                        0,
                        1,
                    ),
                dark: 1 - SINK_DARKEN * eased,
                clip: [
                    toScreenX(view, pocket.x) * pixelRatio,
                    (view.height - toScreenY(view, pocket.y)) * pixelRatio,
                    rimRadius * pixelRatio,
                ],
            },
        );
    }
}

// two layers, as on a real table: a tight contact shadow where the ball meets the felt, dark on every side
// because the ball blocks light from all directions there; then the soft lamp shadow, pushed outward and
// stretched with distance from the lamp above the table centre
function drawShadows(renderer, view, balls) {
    const radius = BALL_RADIUS * view.scale,
        offsetScale = BALL_RADIUS / (LAMP_HEIGHT - BALL_RADIUS);
    for (const ball of balls) {
        drawShadow(
            renderer,
            view,
            toScreenX(view, ball.x),
            toScreenY(view, ball.y),
            radius * CONTACT_SHADOW.size,
            CONTACT_SHADOW,
        );
    }
    for (const ball of balls) {
        const dx = ball.x - PLAY_WIDTH / 2,
            dy = ball.y - PLAY_HEIGHT / 2,
            distance = Math.hypot(dx, dy) || 1;
        drawShadow(
            renderer,
            view,
            toScreenX(view, ball.x + dx * offsetScale),
            toScreenY(view, ball.y + dy * offsetScale),
            radius * LAMP_SHADOW.size,
            {
                ...LAMP_SHADOW,
                directionX: dx / distance,
                directionY: -dy / distance, // y flipped: GL y points up
                stretch: Math.hypot(1, distance / LAMP_HEIGHT),
            },
        );
    }
}

function drawBalls(renderer, view, balls) {
    const radius = BALL_RADIUS * view.scale;
    for (const ball of balls)
        drawBall(
            renderer,
            view,
            ball.number,
            ball.orientation,
            toScreenX(view, ball.x),
            toScreenY(view, ball.y),
            radius,
        );
}

// the 8 never shows here: potting it ends the rack
function drawPottedBalls(renderer, view, potted) {
    for (const number of potted) {
        if (number !== 8)
            drawBall(
                renderer,
                view,
                number,
                IDENTITY,
                hudBallX(view, number),
                hudY(view),
                HUD_BALL_RADIUS,
            );
    }
}
