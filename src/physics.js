// Ball motion: sub-stepped movement, collisions, potting and the drop into the pocket. No DOM, GL or audio here:
// impacts are recorded in game.events ({ type, speed }) for the sound module to play.
// Standard math notation (dx, vx, normalX) is kept in these hot loops for readability.
import {
    PLAY_WIDTH,
    PLAY_HEIGHT,
    BALL_RADIUS,
    BALL_RESTITUTION,
    BALL_FRICTION,
    RAIL_RESTITUTION_SLOW,
    RAIL_RESTITUTION_LOSS,
    RAIL_RESTITUTION_MIN,
    GRAVITY,
    SLIDING_FRICTION,
    SLIP_EPSILON,
    DRAG,
    ROLLING_RESISTANCE,
    SINK_DURATION,
    MAX_SHOT_SPEED,
    POCKET_ENTRY_NARROWING,
    POCKET_RIM_RESTITUTION,
    POCKETS,
    CUSHION_SEGMENTS,
    clamp,
    CLOTH_DRIFT,
    CLOTH_DRIFT_MAX_SPEED,
    shuffleInPlace,
} from "./constants.js";

const MAX_SUBSTEP_TRAVEL = 0.4 * BALL_RADIUS; // no ball moves further per sub-step, so none tunnels through another
const SPIN_PER_SLIP_FRICTION = 2.5; // solid sphere: friction at the contact point changes the spin 2.5 times as fast (in v/R) as the speed
const SLIP_PER_FRICTION = 1 + SPIN_PER_SLIP_FRICTION; // so the contact-point slip shrinks 3.5 times as fast as the speed changes
const BALL_COLLISION_PASSES = 3; // one pass passes energy on through the rack too slowly
const MAX_SINK_ENTRY_SPEED = 900;
const POCKET_PULL = 300;
const POCKET_DAMPING = 14;
const POCKET_WALL_BOUNCE = 1.3;
const POCKET_BALL_DEPTH = 0.72; // how far a sinking ball sits inside the pocket wall, in ball radii

export function step(game, dt) {
    const substeps = Math.max(
        1,
        Math.ceil((fastestSpeed(game.balls) * dt) / MAX_SUBSTEP_TRAVEL),
    );
    const substepTime = dt / substeps;
    for (let substep = 0; substep < substeps; substep++) {
        moveBalls(game.balls, substepTime);
        collideBalls(game.balls, game.events);
        collideCushions(game.balls, game.events);
        capturePottedBalls(game);
    }
}

// the per-sub-step loops use Math.sqrt, not Math.hypot, and no closures or temporary arrays: they allocate, and the garbage causes frame hitches
function fastestSpeed(balls) {
    let fastest = 0;
    for (const ball of balls)
        fastest = Math.max(
            fastest,
            Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy),
        );
    return fastest;
}

function moveBalls(balls, time) {
    for (const ball of balls) {
        ball.x += ball.vx * time;
        ball.y += ball.vy * time;
        turnBall(ball, time);
        const slipX = ball.vx - BALL_RADIUS * ball.wy,
            slipY = ball.vy + BALL_RADIUS * ball.wx,
            slip = Math.sqrt(slipX * slipX + slipY * slipY);
        if (slip > SLIP_EPSILON) skidOnCloth(ball, slipX, slipY, slip, time);
        else rollOnCloth(ball, time);
    }
}

function turnBall(ball, time) {
    const spin = Math.sqrt(ball.wx * ball.wx + ball.wy * ball.wy);
    if (spin > 0) rotateBall(ball, ball.wx / spin, ball.wy / spin, spin * time);
}

// the cloth drags the contact point against the slip: the ball slows and its spin changes until the slip is gone, then it rolls
function skidOnCloth(ball, slipX, slipY, slip, time) {
    const speedChange = Math.min(
            SLIDING_FRICTION * GRAVITY * time,
            slip / SLIP_PER_FRICTION, // never past the point where the slip is zero
        ),
        directionX = slipX / slip,
        directionY = slipY / slip,
        spinChange = (SPIN_PER_SLIP_FRICTION * speedChange) / BALL_RADIUS;
    ball.vx -= speedChange * directionX;
    ball.vy -= speedChange * directionY;
    ball.wy += spinChange * directionX;
    ball.wx -= spinChange * directionY;
}

function rollOnCloth(ball, time) {
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 0) {
        const slowdown =
            Math.max(0, speed - (DRAG * speed + ROLLING_RESISTANCE) * time) /
            speed;
        ball.vx *= slowdown;
        ball.vy *= slowdown;
        driftOnCloth(ball, speed, time);
    }
    ball.wy = ball.vx / BALL_RADIUS;
    ball.wx = -ball.vy / BALL_RADIUS;
}

// slow balls wander off their line a little, as on real cloth; turning the velocity keeps the speed, so no energy is added
function driftOnCloth(ball, speed, time) {
    if (speed >= CLOTH_DRIFT_MAX_SPEED) return;
    const fade = 1 - speed / CLOTH_DRIFT_MAX_SPEED,
        turn = (Math.random() - 0.5) * 2 * CLOTH_DRIFT * fade * Math.sqrt(time); // sqrt: the total drift does not depend on the sub-step length
    const cos = Math.cos(turn),
        sin = Math.sin(turn);
    const turnedX = ball.vx * cos - ball.vy * sin;
    ball.vy = ball.vx * sin + ball.vy * cos;
    ball.vx = turnedX;
}

function collideBalls(balls, events) {
    for (let pass = 0; pass < BALL_COLLISION_PASSES; pass++)
        collideBallPairs(shuffleInPlace(balls), events);
}

// random pair order (game.balls is reordered in place, to allocate nothing): a fixed order broke the rack's mirror symmetry the same way every break
function collideBallPairs(balls, events) {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const first = balls[i],
                second = balls[j];
            const dx = second.x - first.x,
                dy = second.y - first.y,
                distanceSquared = dx * dx + dy * dy;
            if (
                distanceSquared >= 4 * BALL_RADIUS * BALL_RADIUS ||
                distanceSquared === 0
            )
                continue;
            const distance = Math.sqrt(distanceSquared),
                normalX = dx / distance,
                normalY = dy / distance;
            const overlap = (2 * BALL_RADIUS - distance) / 2;
            first.x -= normalX * overlap;
            first.y -= normalY * overlap;
            second.x += normalX * overlap;
            second.y += normalY * overlap;
            const closingSpeed =
                (second.vx - first.vx) * normalX +
                (second.vy - first.vy) * normalY;
            if (closingSpeed < 0) {
                events.push({ type: "ball", speed: -closingSpeed });
                const impulse = (-(1 + BALL_RESTITUTION) * closingSpeed) / 2;
                first.vx -= impulse * normalX;
                first.vy -= impulse * normalY;
                second.vx += impulse * normalX;
                second.vy += impulse * normalY;
                throwAlongContact(first, second, normalX, normalY, impulse);
            }
        }
    }
}

// friction between the touching surfaces drags the balls along the contact tangent, so a cut ball leaves slightly off the line of centres;
// it only removes sliding (never reverses it), so it cannot add energy
function throwAlongContact(first, second, normalX, normalY, impulse) {
    const tangentX = -normalY,
        tangentY = normalX;
    const sliding =
        (second.vx - first.vx) * tangentX + (second.vy - first.vy) * tangentY;
    const drag = Math.min(BALL_FRICTION * impulse, Math.abs(sliding) / 2),
        direction = sliding > 0 ? drag : -drag;
    first.vx += direction * tangentX;
    first.vy += direction * tangentY;
    second.vx -= direction * tangentX;
    second.vy -= direction * tangentY;
}

function collideCushions(balls, events) {
    for (const ball of balls) {
        for (const [[startX, startY], [endX, endY]] of CUSHION_SEGMENTS) {
            const edgeX = endX - startX,
                edgeY = endY - startY;
            const along = clamp(
                ((ball.x - startX) * edgeX + (ball.y - startY) * edgeY) /
                    (edgeX * edgeX + edgeY * edgeY),
                0,
                1,
            );
            const dx = ball.x - startX - edgeX * along,
                dy = ball.y - startY - edgeY * along,
                distanceSquared = dx * dx + dy * dy;
            if (
                distanceSquared >= BALL_RADIUS * BALL_RADIUS ||
                distanceSquared === 0
            )
                continue;
            const distance = Math.sqrt(distanceSquared),
                normalX = dx / distance,
                normalY = dy / distance;
            const normalSpeed = ball.vx * normalX + ball.vy * normalY;
            ball.x += normalX * (BALL_RADIUS - distance);
            ball.y += normalY * (BALL_RADIUS - distance);
            if (normalSpeed < 0) {
                events.push({ type: "rail", speed: -normalSpeed });
                const restitution = railRestitution(-normalSpeed);
                ball.vx -= (1 + restitution) * normalSpeed * normalX;
                ball.vy -= (1 + restitution) * normalSpeed * normalY;
            }
        }
    }
}

function railRestitution(impactSpeed) {
    return Math.max(
        RAIL_RESTITUTION_MIN,
        RAIL_RESTITUTION_SLOW - RAIL_RESTITUTION_LOSS * impactSpeed,
    );
}

function capturePottedBalls(game) {
    const balls = game.balls;
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i],
            pocket = findCapturingPocket(ball);
        if (!pocket || rejectFastEntry(game, ball, pocket)) continue;
        balls.splice(i, 1);
        const speed = Math.hypot(ball.vx, ball.vy),
            entrySpeedScale = Math.min(1, MAX_SINK_ENTRY_SPEED / (speed || 1));
        game.events.push({ type: "pocket", speed });
        game.sinking.push({
            ...ball,
            vx: ball.vx * entrySpeedScale,
            vy: ball.vy * entrySpeedScale,
            pocket,
            time: 0,
        });
        if (ball.number) {
            game.potted.push(ball.number);
            game.shotPotted.push(ball.number);
        } else {
            game.scratch = true;
        }
    }
}

// a fast ball must come in nearly head-on; otherwise it hits the rim and rattles back out
function rejectFastEntry(game, ball, pocket) {
    const dx = ball.x - pocket.x,
        dy = ball.y - pocket.y,
        distance = Math.sqrt(dx * dx + dy * dy);
    if (distance >= pocket.radius || distance === 0) return false; // escaped balls fall in as before
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy),
        inwardSpeed = -(ball.vx * dx + ball.vy * dy) / distance;
    if (inwardSpeed <= 0) return false;
    const sidewaysSpeed = Math.sqrt(
            Math.max(0, speed * speed - inwardSpeed * inwardSpeed),
        ),
        missDistance = (distance * sidewaysSpeed) / speed;
    const narrowing =
        POCKET_ENTRY_NARROWING * Math.min(1, speed / MAX_SHOT_SPEED);
    if (missDistance < pocket.radius * (1 - narrowing)) return false;
    bounceOffPocketRim(
        game,
        ball,
        pocket,
        dx / distance,
        dy / distance,
        inwardSpeed,
    );
    return true;
}

function bounceOffPocketRim(game, ball, pocket, normalX, normalY, inwardSpeed) {
    game.events.push({ type: "rail", speed: inwardSpeed });
    ball.x = pocket.x + normalX * pocket.radius;
    ball.y = pocket.y + normalY * pocket.radius;
    ball.vx += (1 + POCKET_RIM_RESTITUTION) * inwardSpeed * normalX;
    ball.vy += (1 + POCKET_RIM_RESTITUTION) * inwardSpeed * normalY;
}

function findCapturingPocket(ball) {
    for (const pocket of POCKETS)
        if (squaredDistance(ball, pocket) < pocket.radius * pocket.radius)
            return pocket;
    return isOffTable(ball) ? nearestPocket(ball) : undefined;
}

// safety net: a ball that escapes the cushions goes down the nearest pocket instead of getting lost
function nearestPocket(ball) {
    let nearest = POCKETS[0];
    for (const pocket of POCKETS)
        if (squaredDistance(ball, pocket) < squaredDistance(ball, nearest))
            nearest = pocket;
    return nearest;
}

function squaredDistance(ball, point) {
    return (ball.x - point.x) ** 2 + (ball.y - point.y) ** 2;
}

function isOffTable(ball) {
    return (
        ball.x < -BALL_RADIUS ||
        ball.x > PLAY_WIDTH + BALL_RADIUS ||
        ball.y < -BALL_RADIUS ||
        ball.y > PLAY_HEIGHT + BALL_RADIUS
    );
}

// potted balls are pulled down the hole and bounce off its back wall until SINK_DURATION runs out
export function animateSinking(game, dt) {
    for (const sinking of game.sinking) {
        const pocket = sinking.pocket;
        sinking.time += dt;
        sinking.vx +=
            ((pocket.x - sinking.x) * POCKET_PULL -
                sinking.vx * POCKET_DAMPING) *
            dt;
        sinking.vy +=
            ((pocket.y - sinking.y) * POCKET_PULL -
                sinking.vy * POCKET_DAMPING) *
            dt;
        const moveX = sinking.vx * dt,
            moveY = sinking.vy * dt;
        sinking.x += moveX;
        sinking.y += moveY;
        rollBall(sinking, moveX, moveY);
        bounceOffPocketWall(sinking);
    }
    game.sinking = game.sinking.filter(
        (sinking) => sinking.time < SINK_DURATION,
    );
}

function bounceOffPocketWall(sinking) {
    const pocket = sinking.pocket,
        dx = sinking.x - pocket.x,
        dy = sinking.y - pocket.y,
        distance = Math.hypot(dx, dy);
    const wall = pocket.radius - 1 - BALL_RADIUS * POCKET_BALL_DEPTH;
    const outwardSpeed = (sinking.vx * dx + sinking.vy * dy) / (distance || 1);
    if (distance <= wall || outwardSpeed <= 0) return;
    sinking.x = pocket.x + (dx / distance) * wall;
    sinking.y = pocket.y + (dy / distance) * wall;
    sinking.vx -= (POCKET_WALL_BOUNCE * outwardSpeed * dx) / distance;
    sinking.vy -= (POCKET_WALL_BOUNCE * outwardSpeed * dy) / distance;
}

// roll without slipping: turn about the in-plane axis square to the travel (only the pocket drop uses this; balls on the table have a spin)
function rollBall(ball, dx, dy) {
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance)
        rotateBall(ball, -dy / distance, dx / distance, distance / BALL_RADIUS);
}

// Updated in place, column by column: this runs per ball per sub-step, and fresh arrays here caused GC hitches.
function rotateBall(ball, axisX, axisY, angle) {
    const cos = Math.cos(angle),
        sin = Math.sin(angle),
        versine = 1 - cos,
        orientation = ball.orientation;
    const xx = cos + versine * axisX * axisX,
        xy = versine * axisX * axisY,
        yy = cos + versine * axisY * axisY;
    for (let column = 0; column < 3; column++) {
        const top = orientation[column],
            middle = orientation[3 + column],
            bottom = orientation[6 + column];
        orientation[column] = xx * top + xy * middle + sin * axisY * bottom;
        orientation[3 + column] = xy * top + yy * middle - sin * axisX * bottom;
        orientation[6 + column] =
            -sin * axisY * top + sin * axisX * middle + cos * bottom;
    }
}
