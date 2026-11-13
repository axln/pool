// Pointer input (mouse + touch): aim, pull back or use the slider for power, drag the cue ball when in hand.
import { PLAY_WIDTH, PLAY_HEIGHT, BALL_RADIUS, clamp } from './constants.js';
import { rack, findCueBall, isFreeSpot } from './game.js';

const SLIDER_GRAB_MARGIN = 16;
const MOUSE_GRAB_RADIUS = 1.8; // in ball radii; fingers get a bigger target
const TOUCH_GRAB_RADIUS = 3;
const PULL_FOR_FULL_POWER = 220; // world units of mouse pull-back
const MIN_SHOT_POWER = 0.03; // shorter pulls cancel the shot
const MIN_AIM_DISTANCE = 1;
const DRAG_HANDLERS = { slider: dragSlider, power: dragPower, aim: dragAim, place: dragCueBall };

// app: { game, view, canvases }; handlers read app.view at event time because resizing replaces it
export function bindInput(app) {
    const canvas = app.canvases.overlay;
    canvas.addEventListener('pointerdown', event => handlePointerDown(app, event));
    canvas.addEventListener('pointermove', event => handlePointerMove(app, event));
    canvas.addEventListener('pointerup', () => release(app.game, true));
    canvas.addEventListener('pointercancel', () => release(app.game, false));
    document.getElementById('reset').addEventListener('click', () => rack(app.game));
}

function handlePointerDown(app, event) {
    const game = app.game;
    if (game.state === 'over') {
        rack(game);
        return;
    }
    if (game.state !== 'aim') return;
    app.canvases.overlay.setPointerCapture(event.pointerId);
    game.drag = startDrag(app, event);
}

function startDrag(app, event) {
    const game = app.game, point = toWorld(app.view, event), cueBall = findCueBall(game), mouse = event.pointerType === 'mouse';
    if (isInSlider(app.view.slider, event)) {
        setSliderPower(game, app.view.slider, event);
        return { type: 'slider' };
    }
    const grabRadius = BALL_RADIUS * (mouse ? MOUSE_GRAB_RADIUS : TOUCH_GRAB_RADIUS);
    if (game.inHand && Math.hypot(point.x - cueBall.x, point.y - cueBall.y) < grabRadius) return { type: 'place' };
    if (mouse) return { type: 'power', x: point.x, y: point.y }; // aim is locked while pulling back
    aimAt(game, point); // touch: drag to aim, slider to shoot
    return { type: 'aim' };
}

function isInSlider(slider, event) {
    return event.clientX > slider.x - SLIDER_GRAB_MARGIN && event.clientX < slider.x + slider.width + SLIDER_GRAB_MARGIN
        && event.clientY > slider.y - SLIDER_GRAB_MARGIN && event.clientY < slider.y + slider.height + SLIDER_GRAB_MARGIN;
}

// mouse hover drives aiming between shots; an active drag is routed by its type
function handlePointerMove(app, event) {
    const game = app.game, point = toWorld(app.view, event);
    game.hover = event.pointerType === 'mouse' ? point : null;
    if (game.state !== 'aim' || !game.drag) return;
    DRAG_HANDLERS[game.drag.type](app, event, point);
}

function toWorld(view, event) {
    return { x: (event.clientX - view.originX) / view.scale, y: (event.clientY - view.originY) / view.scale };
}

function dragSlider(app, event) {
    setSliderPower(app.game, app.view.slider, event);
}

function setSliderPower(game, slider, event) {
    game.power = clamp((event.clientY - slider.y) / slider.height, 0, 1);
}

// power is the pull-back distance measured against the aim direction
function dragPower(app, event, point) {
    const game = app.game, drag = game.drag;
    const pull = (drag.x - point.x) * Math.cos(game.aim) + (drag.y - point.y) * Math.sin(game.aim);
    game.power = clamp(pull / PULL_FOR_FULL_POWER, 0, 1);
}

function dragAim(app, event, point) {
    aimAt(app.game, point);
}

export function aimAt(game, point) {
    const cueBall = findCueBall(game);
    if (cueBall && Math.hypot(point.x - cueBall.x, point.y - cueBall.y) > MIN_AIM_DISTANCE) {
        game.aim = Math.atan2(point.y - cueBall.y, point.x - cueBall.x);
    }
}

function dragCueBall(app, event, point) {
    const x = clamp(point.x, BALL_RADIUS, PLAY_WIDTH - BALL_RADIUS), y = clamp(point.y, BALL_RADIUS, PLAY_HEIGHT - BALL_RADIUS);
    if (!isFreeSpot(app.game, x, y)) return;
    const cueBall = findCueBall(app.game);
    cueBall.x = x;
    cueBall.y = y;
}

// a power drag released with enough power starts the stroke; anything else just ends the drag
function release(game, shoot) {
    const drag = game.drag;
    if (shoot && drag && game.state === 'aim' && game.power > MIN_SHOT_POWER && (drag.type === 'slider' || drag.type === 'power')) {
        Object.assign(game, { shotPower: game.power, strikeTime: 0, state: 'strike' });
    }
    game.power = 0;
    game.drag = null;
}
