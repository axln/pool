// WebGL layer: the table texture, ball shadows and balls shaded per pixel on the GPU.
import { TABLE_WIDTH, BALL_COLORS } from "./constants.js";
import { drawTable, createCanvas } from "./table.js";

const SHADER_MODE = { table: 0, shadow: 1, ball: 2 };
const UNIFORMS = [
  "rect",
  "mode",
  "tex",
  "m",
  "col",
  "n",
  "px",
  "alpha",
  "dark",
  "clip",
  "falloff",
];
const QUAD_CORNERS = [-1, -1, 1, -1, -1, 1, 1, 1];
const BALL_RGB = BALL_COLORS.map((color) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255),
);
const ATLAS_TILE = 64; // number atlas: 4 x 4 tiles, tile n at (n % 4, n / 4 | 0)
const ATLAS_FONT_SIZE = 0.62;
const ATLAS_TEXT_DROP = 0.54; // a touch below the tile centre, so digits look optically centred
const NO_CLIP = [0, 0, 1e9];
export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const VERTEX_SHADER = `attribute vec2 a; uniform vec4 u_rect; varying vec2 v;
void main(){ v = a; gl_Position = vec4(u_rect.xy + a * u_rect.zw, 0., 1.); }`;
// ball surface: number spots at the two poles (body +-z), stripe band around body y, one red dot on the cue ball
const FRAGMENT_SHADER = `precision highp float;
varying vec2 v; uniform int u_mode; uniform sampler2D u_tex; uniform mat3 u_m; uniform vec3 u_col;
uniform float u_n, u_px, u_alpha, u_dark, u_falloff; uniform vec3 u_clip;
const float SPOT = 0.47; const vec3 WHITE = vec3(.97, .96, .92);
void main(){
  if (u_mode == 0) { gl_FragColor = texture2D(u_tex, vec2(v.x * .5 + .5, .5 - v.y * .5)); return; }   // table
  float r = length(v);
  if (u_mode == 1) { gl_FragColor = vec4(0., 0., 0., smoothstep(1., u_falloff, length((u_m * vec3(v, 0.)).xy)) * u_alpha); return; } // shadow, u_m squashes the stretched quad back to a disc; full strength inside u_falloff
  vec2 P = vec2(v.x, -v.y);
  vec3 p = vec3(P, sqrt(max(0., 1. - r * r)));   // view-space point on the sphere
  vec3 q = u_m * p;                              // -> body space (u_m is the transposed orientation)
  float w = 1.5 / u_px;                          // ~1.5 px in unit-sphere space, for edge smoothing
  vec2 uv = clamp(vec2(q.z > 0. ? q.x : -q.x, q.y) / SPOT * .5 + .5, .02, .98);
  vec3 num = texture2D(u_tex, (vec2(mod(u_n, 4.), floor(u_n / 4.)) + uv) / 4.).rgb;
  vec3 c = u_col;
  if (u_n < .5) c = mix(WHITE, vec3(.85, .15, .17), smoothstep(.983, .987, q.z));
  else {
    if (u_n > 8.5) c = mix(c, WHITE, smoothstep(.55 - w, .55 + w, abs(q.y)));
    c = mix(c, num, smoothstep(SPOT + w, SPOT - w, length(q.xy)));
  }
  vec3 L = normalize(vec3(-.45, -.55, .7)), Hv = normalize(L + vec3(0., 0., 1.));
  vec3 col = c * (.36 + .74 * max(dot(p, L), 0.)) + vec3(.75 * pow(max(dot(p, Hv), 0.), 70.));
  float rim = 1. - smoothstep(u_clip.z - 1., u_clip.z + 1., distance(gl_FragCoord.xy, u_clip.xy)); // hidden under the pocket rim
  gl_FragColor = vec4(col * u_dark, clamp((1. - r) * u_px, 0., 1.) * u_alpha * rim);
}`;

// null when the browser has no WebGL
export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false });
  if (!gl) return null;
  const program = linkProgram(gl);
  const uniforms = Object.fromEntries(
    UNIFORMS.map((name) => [name, gl.getUniformLocation(program, "u_" + name)]),
  );
  createQuadBuffer(gl);
  gl.enable(gl.BLEND); // straight-alpha source onto a premultiplied canvas
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  const atlasTexture = createAtlasTexture(gl);
  return { gl, uniforms, atlasTexture, tableTexture: gl.createTexture() };
}

function linkProgram(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  gl.useProgram(program);
  return program;
}

function createQuadBuffer(gl) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(QUAD_CORNERS),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

function createAtlasTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    drawNumberAtlas(),
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  return texture;
}

function drawNumberAtlas() {
  const size = 4 * ATLAS_TILE,
    canvas = createCanvas(size, size),
    context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#111";
  context.font = `bold ${ATLAS_TILE * ATLAS_FONT_SIZE}px Arial,sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let number = 1; number < 16; number++) {
    context.fillText(
      number,
      ((number % 4) + 0.5) * ATLAS_TILE,
      (((number / 4) | 0) + ATLAS_TEXT_DROP) * ATLAS_TILE,
    );
  }
  return canvas;
}

// redraws the table at the current scale and uploads it; call after every layout
export function uploadTable(renderer, view) {
  const gl = renderer.gl;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  const scale = Math.min(
    view.scale * view.pixelRatio,
    (gl.getParameter(gl.MAX_TEXTURE_SIZE) - 1) / TABLE_WIDTH,
  );
  gl.bindTexture(gl.TEXTURE_2D, renderer.tableTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    drawTable(scale),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function clearLayer(renderer) {
  renderer.gl.clearColor(0, 0, 0, 0);
  renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
}

// centre and half-sizes in CSS px
export function drawTableQuad(
  renderer,
  view,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
) {
  renderer.gl.bindTexture(renderer.gl.TEXTURE_2D, renderer.tableTexture);
  drawQuad(
    renderer,
    view,
    SHADER_MODE.table,
    centerX,
    centerY,
    halfWidth,
    halfHeight,
  );
  renderer.gl.bindTexture(renderer.gl.TEXTURE_2D, renderer.atlasTexture); // balls sample the number atlas
}

// a dark disc of `radius` that fades out from `falloff` (fraction of the radius) to its edge,
// stretched by `stretch` along the unit direction (directionX, directionY), in GL axes
export function drawShadow(
  renderer,
  view,
  centerX,
  centerY,
  radius,
  { strength, falloff, directionX = 1, directionY = 0, stretch = 1 },
) {
  const { gl, uniforms } = renderer,
    halfSize = radius * stretch;
  gl.uniform1f(uniforms.alpha, strength);
  gl.uniform1f(uniforms.falloff, falloff);
  gl.uniformMatrix3fv(uniforms.m, false, [
    directionX,
    -stretch * directionY,
    0,
    directionY,
    stretch * directionX,
    0,
    0,
    0,
    1,
  ]);
  drawQuad(
    renderer,
    view,
    SHADER_MODE.shadow,
    centerX,
    centerY,
    halfSize,
    halfSize,
  );
}

// look: { alpha, dark, clip } for sinking balls; clip is [x, y, radius] in device px, flipped y
export function drawBall(
  renderer,
  view,
  number,
  orientation,
  centerX,
  centerY,
  radius,
  look = {},
) {
  const { gl, uniforms } = renderer,
    { alpha = 1, dark = 1, clip = NO_CLIP } = look;
  gl.uniformMatrix3fv(uniforms.m, false, orientation); // row-major array read as column-major = transpose, as the shader wants
  gl.uniform3fv(uniforms.col, BALL_RGB[number > 8 ? number - 8 : number]);
  gl.uniform1f(uniforms.n, number);
  gl.uniform1f(uniforms.px, radius * view.pixelRatio);
  gl.uniform1f(uniforms.alpha, alpha);
  gl.uniform1f(uniforms.dark, dark);
  gl.uniform3fv(uniforms.clip, clip);
  drawQuad(renderer, view, SHADER_MODE.ball, centerX, centerY, radius, radius);
}

function drawQuad(
  renderer,
  view,
  mode,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
) {
  const { gl, uniforms } = renderer;
  gl.uniform1i(uniforms.mode, mode);
  gl.uniform4f(
    uniforms.rect,
    (centerX / view.width) * 2 - 1,
    1 - (centerY / view.height) * 2,
    (halfWidth / view.width) * 2,
    (halfHeight / view.height) * 2,
  );
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
