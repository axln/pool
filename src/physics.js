// Ball motion: sub-stepped movement, collisions, potting and the drop into the pocket. No DOM, GL or audio here:
// impacts are recorded in game.events ({ type, speed }) for the sound module to play.
// Standard math notation (dx, vx, normalX) is kept in these hot loops for readability.
import {
    PLAY_WIDTH, PLAY_HEIGHT, BALL_RADIUS, BALL_RESTITUTION, RAIL_RESTITUTION, DRAG, ROLLING_RESISTANCE,
    SINK_DURATION, POCKETS, CUSHION_SEGMENTS, clamp,
} from './constants.js';

const MAX_SUBSTEP_TRAVEL = 0.4 * BALL_RADIUS; // no ball moves further per sub-step, so none tunnels through another
const MAX_SINK_ENTRY_SPEED = 900;
const POCKET_PULL = 300;
const POCKET_DAMPING = 14;
const POCKET_WALL_BOUNCE = 1.3;
const POCKET_BALL_DEPTH = 0.72; // how far a sinking ball sits inside the pocket wall, in ball radii

export function step(game, dt) {
    const substeps = Math.max(1, Math.ceil(fastestSpeed(game.balls) * dt / MAX_SUBSTEP_TRAVEL));
    const substepTime = dt / substeps;
    for (let substep = 0; substep < substeps; substep++) {
        moveBalls(game.balls, substepTime);
        collideBalls(game.balls, game.events);
        collideCushions(game.balls, game.events);
        capturePottedBalls(game);
    }
}

function fastestSpeed(balls) {
    let fastest = 0;
    for (const ball of balls) fastest = Math.max(fastest, Math.hypot(ball.vx, ball.vy));
    return fastest;
}

function moveBalls(balls, time) {
    for (const ball of balls) {
        ball.x += ball.vx * time;
        ball.y += ball.vy * time;
        rollBall(ball, ball.vx * time, ball.vy * time);
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > 0) {
            const slowdown = Math.max(0, speed - (DRAG * speed + ROLLING_RESISTANCE) * time) / speed;
            ball.vx *= slowdown;
            ball.vy *= slowdown;
        }
    }
}

function collideBalls(balls, events) {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const first = balls[i], second = balls[j];
            const dx = second.x - first.x, dy = second.y - first.y, distanceSquared = dx * dx + dy * dy;
            if (distanceSquared >= 4 * BALL_RADIUS * BALL_RADIUS || distanceSquared === 0) continue;
            const distance = Math.sqrt(distanceSquared), normalX = dx / distance, normalY = dy / distance;
            const overlap = (2 * BALL_RADIUS - distance) / 2;
            first.x -= normalX * overlap; first.y -= normalY * overlap;
            second.x += normalX * overlap; second.y += normalY * overlap;
            const closingSpeed = (second.vx - first.vx) * normalX + (second.vy - first.vy) * normalY;
            if (closingSpeed < 0) {
                events.push({ type: 'ball', speed: -closingSpeed });
                const impulse = -(1 + BALL_RESTITUTION) * closingSpeed / 2;
                first.vx -= impulse * normalX; first.vy -= impulse * normalY;
                second.vx += impulse * normalX; second.vy += impulse * normalY;
            }
        }
    }
}

function collideCushions(balls, events) {
    for (const ball of balls) {
        for (const [[startX, startY], [endX, endY]] of CUSHION_SEGMENTS) {
            const edgeX = endX - startX, edgeY = endY - startY;
            const along = clamp(((ball.x - startX) * edgeX + (ball.y - startY) * edgeY) / (edgeX * edgeX + edgeY * edgeY), 0, 1);
            const dx = ball.x - startX - edgeX * along, dy = ball.y - startY - edgeY * along, distanceSquared = dx * dx + dy * dy;
            if (distanceSquared >= BALL_RADIUS * BALL_RADIUS || distanceSquared === 0) continue;
            const distance = Math.sqrt(distanceSquared), normalX = dx / distance, normalY = dy / distance;
            const normalSpeed = ball.vx * normalX + ball.vy * normalY;
            ball.x += normalX * (BALL_RADIUS - distance);
            ball.y += normalY * (BALL_RADIUS - distance);
            if (normalSpeed < 0) {
                events.push({ type: 'rail', speed: -normalSpeed });
                ball.vx -= (1 + RAIL_RESTITUTION) * normalSpeed * normalX;
                ball.vy -= (1 + RAIL_RESTITUTION) * normalSpeed * normalY;
            }
        }
    }
}

function capturePottedBalls(game) {
    const balls = game.balls;
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i], pocket = findCapturingPocket(ball);
        if (!pocket) continue;
        balls.splice(i, 1);
        game.events.push({ type: 'pocket', speed: Math.hypot(ball.vx, ball.vy) });
        const entrySpeedScale = Math.min(1, MAX_SINK_ENTRY_SPEED / (Math.hypot(ball.vx, ball.vy) || 1));
        game.sinking.push({
            number: ball.number, x: ball.x, y: ball.y, vx: ball.vx * entrySpeedScale, vy: ball.vy * entrySpeedScale,
            orientation: ball.orientation, pocket, time: 0,
        });
        if (ball.number) {
            game.potted.push(ball.number);
            game.potsThisShot++;
        } else {
            game.scratch = true;
        }
    }
}

function findCapturingPocket(ball) {
    const pocket = POCKETS.find(candidate => squaredDistance(ball, candidate) < candidate.radius * candidate.radius);
    if (pocket || !isOffTable(ball)) return pocket;
    // safety net: a ball that escapes the cushions goes down the nearest pocket instead of getting lost
    return POCKETS.reduce((nearest, candidate) => squaredDistance(ball, candidate) < squaredDistance(ball, nearest) ? candidate : nearest);
}

function squaredDistance(ball, point) {
    return (ball.x - point.x) ** 2 + (ball.y - point.y) ** 2;
}

function isOffTable(ball) {
    return ball.x < -BALL_RADIUS || ball.x > PLAY_WIDTH + BALL_RADIUS || ball.y < -BALL_RADIUS || ball.y > PLAY_HEIGHT + BALL_RADIUS;
}

// potted balls are pulled down the hole and bounce off its back wall until SINK_DURATION runs out
export function animateSinking(game, dt) {
    for (const sinking of game.sinking) {
        const pocket = sinking.pocket;
        sinking.time += dt;
        sinking.vx += ((pocket.x - sinking.x) * POCKET_PULL - sinking.vx * POCKET_DAMPING) * dt;
        sinking.vy += ((pocket.y - sinking.y) * POCKET_PULL - sinking.vy * POCKET_DAMPING) * dt;
        const moveX = sinking.vx * dt, moveY = sinking.vy * dt;
        sinking.x += moveX;
        sinking.y += moveY;
        rollBall(sinking, moveX, moveY);
        bounceOffPocketWall(sinking);
    }
    game.sinking = game.sinking.filter(sinking => sinking.time < SINK_DURATION);
}

function bounceOffPocketWall(sinking) {
    const pocket = sinking.pocket, dx = sinking.x - pocket.x, dy = sinking.y - pocket.y, distance = Math.hypot(dx, dy);
    const wall = pocket.radius - 1 - BALL_RADIUS * POCKET_BALL_DEPTH;
    const outwardSpeed = (sinking.vx * dx + sinking.vy * dy) / (distance || 1);
    if (distance <= wall || outwardSpeed <= 0) return;
    sinking.x = pocket.x + dx / distance * wall;
    sinking.y = pocket.y + dy / distance * wall;
    sinking.vx -= POCKET_WALL_BOUNCE * outwardSpeed * dx / distance;
    sinking.vy -= POCKET_WALL_BOUNCE * outwardSpeed * dy / distance;
}

// roll without slipping: rotate the ball's orientation about the in-plane axis square to its travel
function rollBall(ball, dx, dy) {
    const distance = Math.hypot(dx, dy);
    if (!distance) return;
    const axisX = -dy / distance, axisY = dx / distance, angle = distance / BALL_RADIUS;
    const cos = Math.cos(angle), sin = Math.sin(angle), versine = 1 - cos, current = ball.orientation;
    const rotation = [
        cos + versine * axisX * axisX, versine * axisX * axisY, sin * axisY,
        versine * axisX * axisY, cos + versine * axisY * axisY, -sin * axisX,
        -sin * axisY, sin * axisX, cos,
    ];
    const result = [];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            result[row * 3 + column] = rotation[row * 3] * current[column]
                + rotation[row * 3 + 1] * current[3 + column] + rotation[row * 3 + 2] * current[6 + column];
        }
    }
    ball.orientation = result;
}
