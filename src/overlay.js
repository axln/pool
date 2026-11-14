// 2D overlay above the WebGL layer: HUD, power slider, aim guide, cue stick and messages.
import {
    PLAY_WIDTH,
    PLAY_HEIGHT,
    BALL_RADIUS,
    FRAME_WIDTH,
    LAMP_HEIGHT,
    TABLE_WIDTH,
    STRIKE_DURATION,
    ANNOUNCEMENT_HOLD,
    ANNOUNCEMENT_FADE,
} from "./constants.js";
import { findCueBall } from "./game.js";
import { HUD_BALL_RADIUS, hudBallX, hudY } from "./view.js";
import { FULL_TURN, gradient } from "./table.js";

const HUD_HEIGHT = 44;
const GROUP_LABELS = { solids: "Solids", stripes: "Stripes" };
const GROUP_END_BALLS = { solids: [1, 7], stripes: [9, 15] }; // the HUD slots a group spans
const HUD_DIM_COLOR = "rgba(12,15,21,.65)"; // the page background, laid over the idle player's slots
const SLIDER_RADIUS = 11;
const SLIDER_STOPS = [
    [0, "#3ecf6e"],
    [0.55, "#f2c230"],
    [1, "#e0382c"],
];
const SLIDER_HANDLE_OVERHANG = 6;
const SLIDER_HANDLE_HEIGHT = 10;
const SLIDER_LABEL_GAP = 14;
const IN_HAND_RING = 1.8; // dashed ring around a cue ball in hand, in ball radii
const CUE_PULL_PER_POWER = 120; // world units the cue draws back at full power
const CUE_FOLLOW_THROUGH = 4;
const CUE_GAP = 5; // between the cue tip and the ball at rest
const CUE_TIP_HEIGHT = BALL_RADIUS; // the tip meets the ball at its centre height
const CUE_TILT = 0.18; // the cue rises this much per unit of length towards the butt
// a faint wide layer under a darker core gives the shadow a soft edge; spread widens each side
const CUE_SHADOW_LAYERS = [
    { spread: 2.5, color: "rgba(0,0,0,.09)" },
    { spread: 0, color: "rgba(0,0,0,.2)" },
];
const SHAFT_STOPS = [
    [0, "#ecd09a"],
    [1, "#c4914f"],
];
// [from, to, width at from, width at to, fill]; distances from the tip, 'shaft' marks the gradient
const CUE_BODY = [
    [0, 3, 4.2, 4.3, "#3f7fd6"], // chalked tip
    [3, 11, 4.3, 4.6, "#f2efe6"], // ferrule
    [11, 260, 4.6, 7.6, "shaft"],
    [260, 450, 7.6, 10, "#2b1710"], // butt
];
const CUE_TRIM = [
    // rings, wrap, bumper and gloss: not part of the shadow
    [260, 265, 7.6, 7.7, "#c9a24a"],
    [330, 333, 8.5, 8.5, "#c9a24a"],
    [340, 420, 8.6, 9.6, "#15100e"],
    [423, 426, 9.7, 9.7, "#c9a24a"],
    [442, 450, 9.9, 10, "#0a0a0a"],
    [11, 440, 1.2, 2, "rgba(255,255,255,.22)"],
];
const GHOST_INSET = 1.3; // ghost ball drawn a little inside the real outline
const TARGET_PATH_BASE = 28;
const TARGET_PATH_PER_CUT = 70; // a fuller hit sends the target further
const CUE_PATH_BASE = 18;
const CUE_PATH_PER_DEFLECTION = 60;
const MIN_DEFLECTION = 0.02; // below this the cue ball follows straight through; no line
const REBOUND_LENGTH = 45;
const RAIL_EPSILON = 0.01;
const GUIDE_OUTLINE = "rgba(0,20,45,.45)";
const GUIDE_OUTLINE_WIDTH = 4.6;
const GUIDE_COLOR = "rgba(255,255,255,.95)";
const GUIDE_WIDTH = 2.6;
const MESSAGE_HALF_WIDTH = 210;
const MESSAGE_HALF_HEIGHT = 44;
const MESSAGE_PADDING = 28; // space between a long message and the panel edge

// one frame of the overlay; world-space items use the table transform, the rest CSS pixels
export function drawOverlay(context, view, game) {
    const { pixelRatio, scale, originX, originY } = view;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, view.width, view.height);
    drawHud(context, view, game);
    context.setTransform(
        pixelRatio * scale,
        0,
        0,
        pixelRatio * scale,
        pixelRatio * originX,
        pixelRatio * originY,
    );
    drawCueBallTools(context, game);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (game.message) drawMessage(context, view, game.message);
    if (game.announcement) drawAnnouncement(context, view, game.announcement);
}

function drawHud(context, view, game) {
    const left = view.originX - FRAME_WIDTH * view.scale,
        width = TABLE_WIDTH * view.scale,
        y = hudY(view);
    context.fillStyle = "rgba(255,255,255,.06)";
    context.beginPath();
    context.roundRect(
        left,
        y - HUD_HEIGHT / 2,
        width,
        HUD_HEIGHT,
        HUD_HEIGHT / 2,
    );
    context.fill();
    drawEmptySlots(context, view, game.potted, y);
    dimIdlePlayerSlots(context, view, game, y);
    drawPlayerLabel(context, game, left + width / 2, y);
    drawPowerSlider(context, view.slider, game.power);
}

// an outline for every ball still on the table; potted balls are drawn into their slot by WebGL
function drawEmptySlots(context, view, potted, y) {
    context.strokeStyle = "rgba(255,255,255,.16)";
    context.lineWidth = 1;
    for (let number = 1; number < 16; number++) {
        if (number === 8 || potted.includes(number)) continue;
        context.beginPath();
        context.arc(
            hudBallX(view, number),
            y,
            HUD_BALL_RADIUS - 1,
            0,
            FULL_TURN,
        );
        context.stroke();
    }
}

// the player who is not shooting gets their group's slots, potted balls included, dimmed
function dimIdlePlayerSlots(context, view, game, y) {
    const idleGroup = game.groups[3 - game.player];
    if (!idleGroup) return;
    const slotXs = GROUP_END_BALLS[idleGroup].map((number) =>
            hudBallX(view, number),
        ),
        left = Math.min(...slotXs) - HUD_BALL_RADIUS,
        right = Math.max(...slotXs) + HUD_BALL_RADIUS;
    context.fillStyle = HUD_DIM_COLOR;
    context.beginPath();
    context.roundRect(
        left,
        y - HUD_BALL_RADIUS,
        right - left,
        2 * HUD_BALL_RADIUS,
        HUD_BALL_RADIUS,
    );
    context.fill();
}

function drawPlayerLabel(context, game, x, y) {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.font = "600 16px system-ui,sans-serif";
    context.fillText(
        playerCaption(game.player, game.groups[game.player]),
        x,
        game.inHand ? y - 7 : y,
    );
    if (!game.inHand) return;
    context.fillStyle = "rgba(255,255,255,.65)";
    context.font = "11px system-ui,sans-serif";
    context.fillText(
        game.handPlaced
            ? "Ball in hand — drag the cue ball to move it"
            : "Ball in hand — drag to place it",
        x,
        y + 10,
    );
}

function drawPowerSlider(context, slider, power) {
    context.fillStyle = "rgba(0,0,0,.45)";
    context.beginPath();
    context.roundRect(
        slider.x,
        slider.y,
        slider.width,
        slider.height,
        SLIDER_RADIUS,
    );
    context.fill();
    context.save();
    context.clip();
    context.fillStyle = gradient(
        context.createLinearGradient(0, slider.y, 0, slider.y + slider.height),
        SLIDER_STOPS,
    );
    context.fillRect(slider.x, slider.y, slider.width, slider.height * power);
    context.restore();
    context.strokeStyle = "rgba(255,255,255,.2)";
    context.lineWidth = 1;
    context.stroke(); // the track outline: the rounded rect is still the current path
    context.fillStyle = "#e9edf5";
    context.beginPath();
    context.roundRect(
        slider.x - SLIDER_HANDLE_OVERHANG,
        slider.y + slider.height * power - SLIDER_HANDLE_HEIGHT / 2,
        slider.width + 2 * SLIDER_HANDLE_OVERHANG,
        SLIDER_HANDLE_HEIGHT,
        SLIDER_HANDLE_HEIGHT / 2,
    );
    context.fill();
    context.fillStyle = "rgba(255,255,255,.5)";
    context.font = "10px system-ui,sans-serif";
    context.fillText(
        "POWER",
        slider.x + slider.width / 2,
        slider.y - SLIDER_LABEL_GAP,
    );
}

// ball-in-hand ring, aim guide and cue while aiming (none of the latter before the first placement); the cue alone during the stroke
function drawCueBallTools(context, game) {
    const cueBall = findCueBall(game);
    if (!cueBall) return;
    if (game.state === "aim") {
        if (game.inHand) drawInHandRing(context, cueBall);
        if (game.inHand && !game.handPlaced) return; // first placement: no aim guide or cue yet
        if (game.drag?.type === "place") return;
        drawGuide(context, game, cueBall);
        drawCue(context, cueBall, game.aim, game.power * CUE_PULL_PER_POWER);
    } else if (game.state === "strike") {
        const pull =
            game.shotPower *
                CUE_PULL_PER_POWER *
                (1 - game.strikeTime / STRIKE_DURATION) -
            CUE_FOLLOW_THROUGH;
        drawCue(context, cueBall, game.aim, pull);
    }
}

function drawInHandRing(context, cueBall) {
    context.strokeStyle = "rgba(255,255,255,.6)";
    context.lineWidth = 1.2;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.arc(cueBall.x, cueBall.y, BALL_RADIUS * IN_HAND_RING, 0, FULL_TURN);
    context.stroke();
    context.setLineDash([]);
}

function drawGuide(context, game, cueBall) {
    const directionX = Math.cos(game.aim),
        directionY = Math.sin(game.aim);
    const { distance, hitBall } = findGuideTarget(
        game.balls,
        cueBall,
        directionX,
        directionY,
    );
    const ghostX = cueBall.x + directionX * distance,
        ghostY = cueBall.y + directionY * distance;
    const path = new Path2D();
    if (distance > BALL_RADIUS)
        addLine(
            path,
            cueBall.x + directionX * BALL_RADIUS,
            cueBall.y + directionY * BALL_RADIUS,
            ghostX,
            ghostY,
        );
    path.moveTo(ghostX + BALL_RADIUS - GHOST_INSET, ghostY);
    path.arc(ghostX, ghostY, BALL_RADIUS - GHOST_INSET, 0, FULL_TURN);
    if (hitBall)
        addDeflectionLines(
            path,
            hitBall,
            ghostX,
            ghostY,
            directionX,
            directionY,
        );
    else addReboundLine(path, ghostX, ghostY, directionX, directionY);
    strokeGuide(context, path);
}

// distance along the aim to the first ball hit, or to the cushion line if none
function findGuideTarget(balls, cueBall, directionX, directionY) {
    const contactSquared = 4 * BALL_RADIUS * BALL_RADIUS;
    let distance = Infinity,
        hitBall = null;
    for (const ball of balls) {
        if (!ball.number) continue;
        const toBallX = ball.x - cueBall.x,
            toBallY = ball.y - cueBall.y,
            along = toBallX * directionX + toBallY * directionY;
        if (along <= 0) continue;
        const missSquared =
            toBallX * toBallX + toBallY * toBallY - along * along;
        if (missSquared >= contactSquared) continue;
        const contact = along - Math.sqrt(contactSquared - missSquared);
        if (contact < distance) {
            distance = contact;
            hitBall = ball;
        }
    }
    if (!hitBall) distance = distanceToRail(cueBall, directionX, directionY);
    return { distance, hitBall };
}

function distanceToRail(cueBall, directionX, directionY) {
    const toSide =
        directionX > 0
            ? (PLAY_WIDTH - BALL_RADIUS - cueBall.x) / directionX
            : directionX < 0
              ? (BALL_RADIUS - cueBall.x) / directionX
              : Infinity;
    const toEnd =
        directionY > 0
            ? (PLAY_HEIGHT - BALL_RADIUS - cueBall.y) / directionY
            : directionY < 0
              ? (BALL_RADIUS - cueBall.y) / directionY
              : Infinity;
    return Math.max(0, Math.min(toSide, toEnd));
}

// target ball along the line of centres; cue ball along the tangent, both longer for a stronger share
function addDeflectionLines(
    path,
    hitBall,
    ghostX,
    ghostY,
    directionX,
    directionY,
) {
    const normalX = (hitBall.x - ghostX) / (2 * BALL_RADIUS),
        normalY = (hitBall.y - ghostY) / (2 * BALL_RADIUS);
    const fullness = directionX * normalX + directionY * normalY;
    const targetLength = TARGET_PATH_BASE + TARGET_PATH_PER_CUT * fullness;
    addLine(
        path,
        hitBall.x + normalX * BALL_RADIUS,
        hitBall.y + normalY * BALL_RADIUS,
        hitBall.x + normalX * (BALL_RADIUS + targetLength),
        hitBall.y + normalY * (BALL_RADIUS + targetLength),
    );
    const tangentX = directionX - fullness * normalX,
        tangentY = directionY - fullness * normalY;
    const deflection = Math.hypot(tangentX, tangentY);
    if (deflection <= MIN_DEFLECTION) return;
    const cueLength =
        BALL_RADIUS + CUE_PATH_BASE + CUE_PATH_PER_DEFLECTION * deflection;
    addLine(
        path,
        ghostX + (tangentX / deflection) * BALL_RADIUS,
        ghostY + (tangentY / deflection) * BALL_RADIUS,
        ghostX + (tangentX / deflection) * cueLength,
        ghostY + (tangentY / deflection) * cueLength,
    );
}

// no ball in the way: a short line mirrored off the cushion the ghost ball touches
function addReboundLine(path, ghostX, ghostY, directionX, directionY) {
    const atSide =
        ghostX <= BALL_RADIUS + RAIL_EPSILON ||
        ghostX >= PLAY_WIDTH - BALL_RADIUS - RAIL_EPSILON;
    const atEnd =
        ghostY <= BALL_RADIUS + RAIL_EPSILON ||
        ghostY >= PLAY_HEIGHT - BALL_RADIUS - RAIL_EPSILON;
    const reboundX = atSide ? -directionX : directionX,
        reboundY = atEnd ? -directionY : directionY;
    addLine(
        path,
        ghostX,
        ghostY,
        ghostX + reboundX * REBOUND_LENGTH,
        ghostY + reboundY * REBOUND_LENGTH,
    );
}

function addLine(path, startX, startY, endX, endY) {
    path.moveTo(startX, startY);
    path.lineTo(endX, endY);
}

// soft dark outline first, so the white guide reads on the light centre of the felt
function strokeGuide(context, path) {
    context.lineCap = context.lineJoin = "round";
    context.strokeStyle = GUIDE_OUTLINE;
    context.lineWidth = GUIDE_OUTLINE_WIDTH;
    context.stroke(path);
    context.strokeStyle = GUIDE_COLOR;
    context.lineWidth = GUIDE_WIDTH;
    context.stroke(path);
}

// the shadow pass draws the body only, offset; the real pass adds the trim
function drawCue(context, cueBall, aim, pull) {
    const tipX = -(BALL_RADIUS + CUE_GAP + pull);
    drawCueShadow(context, cueBall, aim, tipX);
    context.save();
    context.translate(cueBall.x, cueBall.y);
    context.rotate(aim);
    const shaft = gradient(
        context.createLinearGradient(tipX - 11, 0, tipX - 260, 0),
        SHAFT_STOPS,
    );
    for (const part of CUE_BODY)
        drawCuePart(context, tipX, part, part[4] === "shaft" ? shaft : part[4]);
    for (const part of CUE_TRIM) drawCuePart(context, tipX, part, part[4]);
    context.restore();
}

// the cue is lit by the lamp over the table centre, like the balls: each point of it casts its shadow
// outward from the centre by its height over the felt, and the raised butt end throws it furthest
function drawCueShadow(context, cueBall, aim, tipX) {
    const cos = Math.cos(aim),
        sin = Math.sin(aim);
    for (const { spread, color } of CUE_SHADOW_LAYERS) {
        context.fillStyle = color;
        for (const [from, to, widthFrom, widthTo] of CUE_BODY) {
            const corners = [
                [from, -widthFrom],
                [to, -widthTo],
                [to, widthTo],
                [from, widthFrom],
            ];
            context.beginPath();
            corners.forEach(([distance, width], index) => {
                const alongCue = tipX - distance,
                    acrossCue = width / 2 + Math.sign(width) * spread,
                    x = cueBall.x + alongCue * cos - acrossCue * sin,
                    y = cueBall.y + alongCue * sin + acrossCue * cos,
                    height = CUE_TIP_HEIGHT + distance * CUE_TILT,
                    lean = height / (LAMP_HEIGHT - height),
                    shadowX = x + (x - PLAY_WIDTH / 2) * lean,
                    shadowY = y + (y - PLAY_HEIGHT / 2) * lean;
                if (index) context.lineTo(shadowX, shadowY);
                else context.moveTo(shadowX, shadowY);
            });
            context.fill();
        }
    }
}

function drawCuePart(context, tipX, [from, to, widthFrom, widthTo], fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(tipX - from, -widthFrom / 2);
    context.lineTo(tipX - to, -widthTo / 2);
    context.lineTo(tipX - to, widthTo / 2);
    context.lineTo(tipX - from, widthFrom / 2);
    context.fill();
}

function drawMessage(context, view, message) {
    const { centerX, centerY } = tableCenter(view);
    context.font = "600 20px system-ui,sans-serif";
    // long messages widen the panel instead of spilling out of it
    const halfWidth = Math.max(
        MESSAGE_HALF_WIDTH,
        context.measureText(message).width / 2 + MESSAGE_PADDING,
    );
    context.fillStyle = "rgba(8,10,14,.82)";
    context.beginPath();
    context.roundRect(
        centerX - halfWidth,
        centerY - MESSAGE_HALF_HEIGHT,
        2 * halfWidth,
        2 * MESSAGE_HALF_HEIGHT,
        16,
    );
    context.fill();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.fillText(message, centerX, centerY - 10);
    context.fillStyle = "rgba(255,255,255,.6)";
    context.font = "13px system-ui,sans-serif";
    context.fillText("Click to rack again", centerX, centerY + 18);
}

// fully visible for the hold time, then fading linearly to nothing
function drawAnnouncement(context, view, { player, group, age }) {
    const { centerX, centerY } = tableCenter(view);
    context.globalAlpha = Math.min(
        1,
        1 - (age - ANNOUNCEMENT_HOLD) / ANNOUNCEMENT_FADE,
    );
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 34px system-ui,sans-serif";
    context.shadowColor = "rgba(0,0,0,.7)";
    context.shadowBlur = 12;
    context.fillStyle = "#fff";
    context.fillText(playerCaption(player, group), centerX, centerY);
    context.globalAlpha = 1;
    context.shadowBlur = 0;
}

function playerCaption(player, group) {
    return group
        ? `Player ${player} · ${GROUP_LABELS[group]}`
        : `Player ${player}`;
}

function tableCenter(view) {
    return {
        centerX: view.originX + (PLAY_WIDTH * view.scale) / 2,
        centerY: view.originY + (PLAY_HEIGHT * view.scale) / 2,
    };
}
