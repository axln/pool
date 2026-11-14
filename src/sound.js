// Sound effects: recorded clips (public/sounds, CC0, see CREDITS.md) played with the Web Audio API.
import { clamp } from "./constants.js";

const SAMPLE_COUNTS = { cue: 4, ball: 6, rail: 3, pocket: 1 }; // public/sounds/<type>-<n>.wav
const TYPE_GAIN = { cue: 1, ball: 1, rail: 0.7, pocket: 1 }; // the cushion clips are recorded hotter
const FULL_VOLUME_SPEED = { cue: 1, ball: 1400, rail: 1600, pocket: 900 }; // impact speed that plays at full volume
const MIN_POCKET_VOLUME = 0.4; // even a slow pot should be clearly heard
const MIN_VOLUME = 0.02; // quieter impacts (balls settling against each other) are skipped
const MAX_SOUNDS_PER_FRAME = 6; // a break makes dozens of hits per frame; only the loudest are heard
const MASTER_VOLUME = 0.8;
const PITCH_VARIATION = 0.05; // so repeated clicks do not sound machine-like

// the AudioContext is created on the first user gesture; until the clips are decoded, sounds are dropped
export function createSound() {
    return { context: null, master: null, samples: null };
}

export function unlockSound(sound) {
    if (!sound.context) {
        sound.context = new AudioContext();
        sound.master = sound.context.createGain();
        sound.master.gain.value = MASTER_VOLUME;
        const limiter = sound.context.createDynamicsCompressor(); // a break stacks many clicks; keep them from clipping
        sound.master.connect(limiter);
        limiter.connect(sound.context.destination);
        loadSamples(sound.context).then((samples) => {
            sound.samples = samples;
        });
    }
    if (sound.context.state === "suspended") sound.context.resume();
}

// { type: [AudioBuffer, ...] }; a clip that fails to load is left out, so the game plays on without it
async function loadSamples(context) {
    const entries = await Promise.all(
        Object.entries(SAMPLE_COUNTS).map(async ([type, count]) => {
            const files = Array.from(
                { length: count },
                (unused, index) => `sounds/${type}-${index + 1}.wav`,
            );
            const buffers = await Promise.all(
                files.map((file) => loadSample(context, file)),
            );
            return [type, buffers.filter(Boolean)];
        }),
    );
    return Object.fromEntries(entries);
}

async function loadSample(context, file) {
    try {
        const response = await fetch(file);
        return await context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
        console.warn(`sound ${file} not loaded:`, error);
        return null;
    }
}

export function playSounds(sound, events) {
    if (!sound.samples || sound.context.state !== "running" || !events.length)
        return;
    const loudest = events
        .map((event) => ({ type: event.type, volume: impactVolume(event) }))
        .filter((event) => event.volume >= MIN_VOLUME)
        .sort((first, second) => second.volume - first.volume)
        .slice(0, MAX_SOUNDS_PER_FRAME);
    for (const event of loudest) playSample(sound, event.type, event.volume);
}

function impactVolume(event) {
    const volume = clamp(event.speed / FULL_VOLUME_SPEED[event.type], 0, 1);
    return event.type === "pocket"
        ? Math.max(volume, MIN_POCKET_VOLUME)
        : volume;
}

// a random take of the clip, slightly detuned
function playSample(sound, type, volume) {
    const takes = sound.samples[type];
    if (!takes.length) return;
    const source = sound.context.createBufferSource(),
        gain = sound.context.createGain();
    source.buffer = takes[Math.floor(Math.random() * takes.length)];
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * PITCH_VARIATION;
    gain.gain.value = volume * TYPE_GAIN[type];
    source.connect(gain);
    gain.connect(sound.master);
    source.start();
}
