// Pixel-art rasterizer, ported from the approved mockup without canvas: a sprite is a grid of
// hex colours (null = transparent), so it can be written as SVG rects or compared by hash.
// Parts are shape tests drawn back to front. Each part is shaded by its own mask (1px rim
// light top-left, two dark bands bottom-right); a part sitting behind a later one darkens into
// a soft seam; one dark outline goes around the whole silhouette.
export const SR = {
  crimson: ["#0b0f22", "#3d0712", "#7a1023", "#c21f3a", "#ff7286"],
  crimsonB: ["#0b0f22", "#24040b", "#470a16", "#6e1424", "#99223a"],
  suit: ["#0b0f22", "#10132a", "#1c2246", "#2c3466", "#4c5894"],
  suitB: ["#0b0f22", "#0a0c1c", "#12162f", "#1c2246", "#2c3466"],
  gold: ["#0b0f22", "#6e420c", "#c0841a", "#f2b134", "#ffeab0"],
  metal: ["#0b0f22", "#2a2f55", "#4a5590", "#8d99d6", "#e3e8ff"],
  hair: ["#0b0f22", "#343a66", "#6d78b3", "#b8c1ec", "#ffffff"],
  green: ["#0b0f22", "#0a4f35", "#1fb877", "#3dffa2", "#f0fff8"],
  dark: ["#0b0f22", "#0f132a", "#1a1f40", "#283058", "#414b80"],
  red: ["#0b0f22", "#5a0c1a", "#a3172f", "#e0283f", "#ff8d98"],
  purple: ["#0b0f22", "#2e1a5c", "#5b3fa8", "#8a6cf0", "#d9ccff"],
  blue: ["#0b0f22", "#0d3550", "#1b6f9e", "#4cc9f0", "#d8f7ff"],
  orange: ["#0b0f22", "#5c2308", "#b0480f", "#ff8a3d", "#ffd6b0"],
  white: ["#0b0f22", "#8f9bc8", "#c8d0f0", "#eef1ff", "#ffffff"],
  cable: ["#0b0f22", "#151829", "#2b304e", "#d9b520", "#fff09a"],
  steel: ["#0b0f22", "#252a4c", "#3e4777", "#6470ad", "#b8c2f2"],
  steelB: ["#0b0f22", "#0f1226", "#1c2142", "#2c3360", "#4a548a"],
  pcb: ["#0b0f22", "#063b22", "#0c6b3c", "#14a058", "#5fe39a"],
};
export const OUTC = "#0b0f22";

const inRange = (v, n) => v >= 0 && v < n;
const inGrid = (g, x, y) => inRange(x, g.w) && inRange(y, g.h);

function rampOf(name) {
  const ramp = SR[name];
  if (!ramp) throw new Error(`unknown palette ramp: ${name}`);
  return ramp;
}

// Tone from the part's own mask: lit on the top-left edge, dark one and two pixels in from
// the bottom-right edge, mid everywhere else.
function maskTone(inside, x, y) {
  if (!inside(x, y - 1) || !inside(x - 1, y)) return 4;
  if (!inside(x, y + 1) || !inside(x + 1, y)) return 1;
  if (!inside(x, y + 2) || !inside(x + 2, y)) return 2;
  return 3;
}

function partTone(inside, x, y, opts) {
  const tone = opts.flat ?? maskTone(inside, x, y);
  if (!opts.shade) return tone;
  return opts.shade(x + 0.5, y + 0.5, tone) ?? tone;
}

function fillPart(g, { id, test, ramp, opts }) {
  const inside = (x, y) => inGrid(g, x, y) && test(x + 0.5, y + 0.5);
  for (let k = 0; k < g.w * g.h; k++) {
    const x = k % g.w, y = (k - x) / g.w;
    if (!inside(x, y)) continue;
    g.ids[k] = id;
    g.ramp[k] = ramp;
    g.tone[k] = partTone(inside, x, y, opts);
  }
}

function neighbours(g, k) {
  const x = k % g.w, y = (k - x) / g.w;
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => inGrid(g, a, b))
    .map(([a, b]) => b * g.w + a);
}

// Empty pixels touching the silhouette become outline; a lit pixel touching a later part
// (one drawn in front of it) drops to the darkest tone, which draws the seam between them.
function pixelColour(g, k) {
  const near = neighbours(g, k);
  if (g.ids[k] === -1) return near.some((j) => g.ids[j] !== -1) ? OUTC : null;
  const seam = g.tone[k] > 1 && near.some((j) => g.ids[j] > g.ids[k]);
  return g.ramp[k][seam ? 1 : g.tone[k]];
}

export function makeSprite(w, h, draw) {
  const n = w * h;
  const g = { w, h, ids: new Int16Array(n).fill(-1), ramp: new Array(n), tone: new Int8Array(n) };
  let nextId = 0;
  const part = (test, rampName, opts = {}) => fillPart(g, { id: nextId++, test, ramp: rampOf(rampName), opts });
  const out = draw({ part }) || {};
  const px = Array.from({ length: n }, (_, k) => pixelColour(g, k));
  return { ...out, w, h, px };
}

// ---- shape tests: each returns (x, y) => boolean
export const ell = (ex, ey, rx, ry) => (x, y) => ((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1;
export const tseg = (ax, ay, bx, by, r0, r1) => (x, y) => {
  const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L));
  return Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) <= r0 + (r1 - r0) * t;
};
export const seg = (ax, ay, bx, by, r) => tseg(ax, ay, bx, by, r, r);
export const end = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l];
export const or = (...f) => (x, y) => f.some((t) => t(x, y));

// Even-odd point in polygon.
export const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const bezier = (P, t) => {
  const u = 1 - t;
  const wts = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((d) => wts.reduce((s, wi, i) => s + wi * P[i][d], 0));
};

function bezierSamples(P, r0, r1) {
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.02) pts.push([...bezier(P, t), r0 + (r1 - r0) * t]);
  return pts;
}

const within = (v, lo, hi) => v >= lo && v <= hi;

function paddedBox(pts, pad) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
}

function nearestIndex(pts, x, y) {
  let best = Infinity, bi = 0;
  pts.forEach(([a, c], i) => {
    const d = (x - a) ** 2 + (y - c) ** 2;
    if (d < best) { best = d; bi = i; }
  });
  return bi;
}

// A tapering tube along a cubic Bezier. `at` gives the position along it (0..1) of the
// nearest sample, which is what draws the stripes on a cable sleeve.
export const tube = (P, r0, r1) => {
  const pts = bezierSamples(P, r0, r1);
  const box = paddedBox(pts, r0);
  const f = (x, y) =>
    within(x, box.x0, box.x1) && within(y, box.y0, box.y1) && pts.some(([a, c, r]) => (x - a) ** 2 + (y - c) ** 2 <= r * r);
  f.at = (x, y) => nearestIndex(pts, x, y) / (pts.length - 1);
  return f;
};

// along/across coordinates of a point relative to a segment: t in 0..1, s signed distance
export const segUV = (ax, ay, bx, by) => (x, y) => {
  const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy) || 1;
  return [((x - ax) * vx + (y - ay) * vy) / (L * L), ((x - ax) * vy - (y - ay) * vx) / L, L];
};
export const FAN_STEP = (2 * Math.PI) / 5;
