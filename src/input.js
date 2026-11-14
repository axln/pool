// Pointer input (mouse + touch): aim, pull back or use the slider for power, drag the cue ball when in hand.
import { PLAY_WIDTH, PLAY_HEIGHT, BALL_RADIUS, clamp } from "./constants.js";
import { rack, findCueBall, isFreeSpot } from "./game.js";

const SLIDER_GRAB_MARGIN = 16;
const MOUSE_GRAB_RADIUS = 1.8; // in ball radii; fingers get a bigger target
const TOUCH_GRAB_RADIUS = 3;
const PULL_FOR_FULL_POWER = 220; // world units of mouse pull-back
const MIN_SHOT_POWER = 0.03; // shorter pulls cancel the shot
const MIN_AIM_DISTANCE = 1;
const DRAG_HANDLERS = {
    slider: dragSlider,
    power: dragPower,
    aim: dragAim,
    place: dragCueBall,
};

// app: { game, view, canvases }; handlers read app.view at event time because resizing replaces it
export function bindInput(app) {
    const canvas = app.canvases.overlay;
    canvas.addEventListener("pointerdown", (event) =>
        handlePointerDown(app, event),
    );
    canvas.addEventListener("pointermove", (event) =>
        handlePointerMove(app, event),
    );
    canvas.addEventListener("pointerup", (event) => {
        release(app.game, true);
        updateCursor(app, event);
    });
    canvas.addEventListener("pointercancel", (event) => {
        release(app.game, false);
        updateCursor(app, event);
    });
    document
        .getElementById("reset")
        .addEventListener("click", () => rack(app.game));
}

function handlePointerDown(app, event) {
    const game = app.game;
    if (game.state === "over") {
        rack(game);
        return;
    }
    if (game.state !== "aim") return;
    app.canvases.overlay.setPointerCapture(event.pointerId);
    game.drag = startDrag(app, event);
    updateCursor(app, event);
}

function startDrag(app, event) {
    const game = app.game,
        point = toWorld(app.view, event),
        mouse = event.pointerType === "mouse";
    if (isInSlider(app.view.slider, event)) {
        setSliderPower(game, app.view.slider, event);
        return { type: "slider" };
    }
    if (canStartPlacing(game, point, mouse)) return startPlacing(game, point);
    if (mouse) return { type: "power", x: point.x, y: point.y }; // aim is locked while pulling back
    aimAt(game, point); // touch: drag to aim, slider to shoot
    return { type: "aim" };
}

function isInSlider(slider, event) {
    return (
        event.clientX > slider.x - SLIDER_GRAB_MARGIN &&
        event.clientX < slider.x + slider.width + SLIDER_GRAB_MARGIN &&
        event.clientY > slider.y - SLIDER_GRAB_MARGIN &&
        event.clientY < slider.y + slider.height + SLIDER_GRAB_MARGIN
    );
}

// mouse hover drives aiming between shots; an active drag is routed by its type
function handlePointerMove(app, event) {
    const game = app.game,
        point = toWorld(app.view, event);
    game.hover = event.pointerType === "mouse" ? point : null;
    updateCursor(app, event);
    if (game.state !== "aim" || !game.drag) return;
    DRAG_HANDLERS[game.drag.type](app, event, point);
}

// an open hand over the whole table until the ball is first placed, then over the ball only, a closed one while moving it; otherwise the stylesheet's crosshair
function updateCursor(app, event) {
    const game = app.game,
        point = toWorld(app.view, event),
        canPlace =
            game.state === "aim" &&
            !game.drag &&
            !isInSlider(app.view.slider, event) &&
            canStartPlacing(game, point, event.pointerType === "mouse");
    app.canvases.overlay.style.cursor =
        game.drag?.type === "place" ? "grabbing" : canPlace ? "grab" : "";
}

// until the first drop a mouse can press anywhere to place the ball; after that, and for a finger, the ball itself must be grabbed
function canStartPlacing(game, point, mouse) {
    if (!game.inHand) return false;
    if (mouse && !game.handPlaced) return true;
    const cueBall = findCueBall(game),
        grabRadius =
            BALL_RADIUS * (mouse ? MOUSE_GRAB_RADIUS : TOUCH_GRAB_RADIUS);
    return Math.hypot(point.x - cueBall.x, point.y - cueBall.y) < grabRadius;
}

// remembers the pointer-to-ball offset so the ball moves by the pointer's delta instead of jumping
function startPlacing(game, point) {
    const cueBall = findCueBall(game);
    return { type: "place", dx: cueBall.x - point.x, dy: cueBall.y - point.y };
}

function toWorld(view, event) {
    return {
        x: (event.clientX - view.originX) / view.scale,
        y: (event.clientY - view.originY) / view.scale,
    };
}

function dragSlider(app, event) {
    setSliderPower(app.game, app.view.slider, event);
}

function setSliderPower(game, slider, event) {
    game.power = clamp((event.clientY - slider.y) / slider.height, 0, 1);
}

// power is the pull-back distance measured against the aim direction
function dragPower(app, event, point) {
    const game = app.game,
        drag = game.drag;
    const pull =
        (drag.x - point.x) * Math.cos(game.aim) +
        (drag.y - point.y) * Math.sin(game.aim);
    game.power = clamp(pull / PULL_FOR_FULL_POWER, 0, 1);
}

function dragAim(app, event, point) {
    aimAt(app.game, point);
}

export function aimAt(game, point) {
    const cueBall = findCueBall(game);
    if (
        cueBall &&
        Math.hypot(point.x - cueBall.x, point.y - cueBall.y) > MIN_AIM_DISTANCE
    ) {
        game.aim = Math.atan2(point.y - cueBall.y, point.x - cueBall.x);
    }
}

function dragCueBall(app, event, point) {
    const drag = app.game.drag,
        x = clamp(point.x + drag.dx, BALL_RADIUS, PLAY_WIDTH - BALL_RADIUS),
        y = clamp(point.y + drag.dy, BALL_RADIUS, PLAY_HEIGHT - BALL_RADIUS);
    if (!isFreeSpot(app.game, x, y)) return;
    const cueBall = findCueBall(app.game);
    cueBall.x = x;
    cueBall.y = y;
}

// releasing a placing drag drops the ball; a power drag released with enough power starts the stroke
function release(game, completed) {
    const drag = game.drag;
    if (completed && drag?.type === "place") game.handPlaced = true;
    if (
        completed &&
        drag &&
        game.state === "aim" &&
        game.power > MIN_SHOT_POWER &&
        (drag.type === "slider" || drag.type === "power")
    ) {
        Object.assign(game, {
            shotPower: game.power,
            strikeTime: 0,
            state: "strike",
        });
    }
    game.power = 0;
    game.drag = null;
}
