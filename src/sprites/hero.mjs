import { makeSprite, ell, tseg, seg, end, or, poly, tube, segUV, FAN_STEP } from "./raster.mjs";

// The design: 64x80, facing right. Tall and slim, graphite armor with crimson accents. The head
// trails a bundle of sleeved power cables instead of hair, wears a heatsink crest, a case fan
// where an ear would be and a wraparound visor. The gauntlets are graphics cards, the pauldron
// holds a fan, the tasset is a circuit board. The upper body rotates around the hip, so the
// run leans forward like a sprint.
export const HFW = 64, HFH = 80, FEET = 79, PIVX = 33, PIVY = 46;

// Limbs on the far side use the darker ramps so the body reads in depth.
const FRONT = { thigh: "suit", armor: "steel", toe: "crimson", sole: "gold", knee: "crimson", card: "crimson", bracket: "gold", fist: "steel" };
const BACK = { thigh: "suitB", armor: "steelB", toe: "crimsonB", sole: "suitB", knee: "crimsonB", card: "crimsonB", bracket: "suitB", fist: "suitB" };

const between = (v, lo, hi) => v > lo && v < hi;
const within = (v, lo, hi) => v >= lo && v <= hi;
const evenStep = (v) => Math.floor(v) % 2 === 0;
const oddRow = (y) => Math.floor(y) % 2 === 1;
const near = (v, c, r) => Math.abs(v - c) < r;
const lit = (i) => i > 1;

// `part` draws in screen space; `up` draws a shape given in the upright model, rotated and
// shifted by the pose around the hip pivot.
function makeRig(part, p) {
  const { lean = 0, bob = 0, rot = 0, wave = 0, spin = 0, eye = 4 } = p;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const toScreen = (mx, my) => {
    const dx = mx - PIVX, dy = my - PIVY;
    return [PIVX + dx * cr - dy * sr + lean, PIVY + dx * sr + dy * cr + bob];
  };
  const toModel = (x, y) => {
    const dx = x - lean - PIVX, dy = y - bob - PIVY;
    return [PIVX + dx * cr + dy * sr, PIVY - dx * sr + dy * cr];
  };
  const inModel = (fn) => (x, y, ...rest) => fn(...toModel(x, y), ...rest);
  const up = (test, ramp, opts = {}) => part(inModel(test), ramp, { flat: opts.flat, shade: opts.shade && inModel(opts.shade) });
  return { part, up, toScreen, wave, spin, eye };
}

function drawFan({ up, spin }, { x: fx, y: fy, r, rim }) {
  up(ell(fx, fy, r, r), rim);
  up(ell(fx, fy, r - 1.3, r - 1.3), "dark", { flat: 1 });
  const a0 = (spin * FAN_STEP) / 4;
  for (let q = 0; q < 5; q++) {
    const a = a0 + q * FAN_STEP;
    const blade = tseg(fx + Math.cos(a) * 0.8, fy + Math.sin(a) * 0.8, fx + Math.cos(a + 0.5) * (r - 1.4), fy + Math.sin(a + 0.5) * (r - 1.4), 0.75, 0.55);
    up(blade, "metal", { flat: 3 });
  }
  up(ell(fx, fy, 1.1, 1.1), "gold", { flat: 3 });
}

// ---- legs: thigh, armored shin, boot with two grooves around the ankle, knee guard
const onGroove = (d) => near(d, 5.5, 0.5) || near(d, 7.5, 0.5);
const bootGrooves = (f) => (x, y, i) => {
  if (!lit(i) || y >= f[1]) return null;
  return onGroove(Math.hypot(x - f[0], y - f[1])) ? 1 : null;
};
const bootShape = (k, f) =>
  or(tseg(k[0], k[1], f[0], f[1], 3.1, 4.6),
    poly([[f[0] - 4.5, f[1] - 1], [f[0] + 3, f[1] - 2.5], [f[0] + 11.5, f[1] + 2.4], [f[0] + 11.5, f[1] + 3.6], [f[0] - 4.5, f[1] + 3.6]]));

function drawLeg({ part }, { hip: [hx, hy], th, bend, back }) {
  const pal = back ? BACK : FRONT;
  const k = end(hx, hy, th, 14), f = end(k[0], k[1], th - bend, 15), m = end(hx, hy, th, 8);
  part(tseg(hx, hy, k[0], k[1], 3.6, 3), pal.thigh);
  part(tseg(hx, hy, m[0], m[1], 3.9, 3.3), pal.armor);
  const boot = bootShape(k, f);
  part(boot, pal.armor, { shade: bootGrooves(f) });
  part((x, y) => boot(x, y) && x > f[0] + 3 && y < f[1] + 2.6, pal.toe);
  part((x, y) => boot(x, y) && y >= f[1] + 2.6, pal.sole);
  const s = end(k[0], k[1], th + 1.4, 5);
  part(or(ell(k[0], k[1], 2.9, 2.9), tseg(k[0], k[1], s[0], s[1], 2, 0.4)), pal.knee);
}

// ---- arms: the gauntlet is a graphics card, shroud with heatsink fins and gold PCIe fingers
const onFin = (t, s, L) => between(t, 0.15, 0.7) && near(s, 0, 1.6) && evenStep(t * L);
const cardShade = (e, uv) => (x, y, i) => {
  if (!lit(i)) return null;
  if (Math.hypot(x - e[0], y - e[1]) < 3.2) return 2;
  return i < 4 && onFin(...uv(x, y)) ? 1 : null;
};
const pcieFingers = (card, uv) => (x, y) => {
  if (!card(x, y)) return false;
  const [t, s, L] = uv(x, y);
  return between(t, 0.2, 0.72) && s < -(3 + t * 1.2) + 1.4 && evenStep(t * L);
};

function drawArm({ part }, { shoulder: [sx, sy], a1, a2, back }) {
  const pal = back ? BACK : FRONT;
  const e = end(sx, sy, a1, 9), h = end(e[0], e[1], a2, 9.5), c = end(e[0], e[1], a2, 7.4);
  part(seg(sx, sy, e[0], e[1], 2.6), pal.thigh);
  const card = tseg(e[0], e[1], h[0], h[1], 3, 4.2), uv = segUV(e[0], e[1], h[0], h[1]);
  part(card, pal.card, { shade: cardShade(e, uv) });
  if (!back) part(pcieFingers(card, uv), "gold", { flat: 3 });
  part((x, y) => card(x, y) && Math.hypot(x - c[0], y - c[1]) < 1.7, pal.bracket);
  part(ell(h[0], h[1], 2.9, 2.9), pal.fist);
  return h;
}

// ---- cable bundle trailing from the back of the head: black sleeves and one PCIe lead
const cableRoutes = (w) => [
  [[29, 8], [21, 7 + w], [15, 15 - w], [9, 22 + w * 1.5], 2.3, "suit"],
  [[29, 11], [22, 13 + w], [16, 21 - w], [11, 29 + w * 1.5], 2.5, "cable"],
  [[29, 14], [24, 18 + w], [19, 26 - w * 0.5], [15, 34 + w], 2.3, "suit"],
  [[30, 17], [26, 22 + w], [23, 28], [20, 36 + w], 2.1, "suit"],
];
const powerLeadShade = (cb) => (x, y, i) => {
  if (Math.floor(cb.at(x, y) * 8) % 2) return i === 4 ? 2 : 1;
  return Math.max(i, 3);
};
const sleeveShade = (cb) => (x, y, i) => {
  if (!lit(i)) return null;
  return Math.floor(cb.at(x, y) * 14) % 2 ? 2 : null;
};
const checker = (x, y, i) => (lit(i) && evenStep(x + y) ? 1 : null);

function drawCables({ up, wave }) {
  for (const [a, c, d, e, r, ramp] of cableRoutes(wave)) {
    const cb = tube([a, c, d, e], r, r * 0.85);
    up(cb, ramp, { shade: ramp === "cable" ? powerLeadShade(cb) : sleeveShade(cb) });
    const dir = Math.atan2(e[1] - d[1], e[0] - d[0]);
    up(tseg(e[0], e[1], e[0] + Math.cos(dir) * 2, e[1] + Math.sin(dir) * 2, 2.4, 2.4), "gold", { shade: checker });
  }
}

// ---- torso: graphite chest with crimson collar, vent slots, core, status LEDs, RAM belt,
// circuit-board tasset
const isVent = (x, y) => between(y, 30, 34) && between(x, 30, 36) && evenStep(y);
const chestShade = (x, y, i) => {
  if (!lit(i)) return null;
  if (isVent(x, y)) return 1;
  return x < 29 && y > 26 ? 2 : null;
};
const onTrace = (x, y) =>
  (near(y, 46.5, 0.5) && x < 38) || (near(x, 36.5, 0.5) && between(y, 46.5, 50)) || (near(x, 34.5, 0.6) && near(y, 48.5, 0.6));

function drawChest({ up, spin }) {
  up((x, y) => within(y, 23, 37.5) && Math.abs(x - 33) <= 8 - Math.max(0, y - 29) * 0.55, "steel", { shade: chestShade });
  up((x, y) => within(y, 22.5, 25) && Math.abs(x - 33.5) <= 6.5 - (y - 22.5), "crimson");
  up(ell(38.3, 28.5, 2, 2.3), "green", { shade: (x, y, i) => (i === 1 ? 2 : null) });
  [0, 1, 2].forEach((q) => up((x, y) => near(x, 31 + q * 2, 0.6) && near(y, 35.5, 0.6), (spin + q) % 3 === 0 ? "orange" : "green", { flat: 4 }));
}

function drawWaist({ up, part }) {
  up(ell(33, 40, 4.6, 4.2), "suit", { shade: (x, y, i) => (lit(i) && Math.round(y) % 2 === 0 ? 2 : null) });
  up((x, y) => within(y, 42, 44.6) && Math.abs(x - 33) <= 5.8, "gold");
  [29, 32, 35].forEach((cx0) => up((x, y) => within(x, cx0, cx0 + 2) && within(y, 42.6, 44), "dark", { flat: 2 }));
  part(ell(33, 46.5, 5.2, 3), "suit");
  const tas = poly([[33, 44], [40.5, 44], [39, 52], [33.5, 49.5]]);
  up(tas, "pcb");
  up((x, y) => tas(x, y) && onTrace(x, y), "gold", { flat: 3 });
}

// ---- head: heatsink crest, graphite helmet, side fan, wraparound visor, grille jaw
const visorShade = (eye) => (x, y, i) => {
  if (i === 1) return 2;
  if (y < 12.4 && between(x, 35, 40)) return 4;
  return between(x, 37.5, 40.5) ? eye : 3;
};
const helm = (x, y) => ell(34, 13.5, 7.4, 7.8)(x, y) && y <= 19;
const helmSeam = (x, y, i) => (lit(i) && near(x, 29, 0.5) && between(y, 8, 17) ? 1 : null);

function drawHead(rig) {
  const { up, eye } = rig;
  up(seg(32, 20, 33.5, 24, 3), "suit");
  up(poly([[27, 7], [39, 7], [37.5, 1], [28.5, 2.5]]), "metal", { shade: (x, y, i) => (lit(i) && evenStep(x) ? 1 : null) });
  up(helm, "steel", { shade: helmSeam });
  up((x, y) => helm(x, y) && within(y, 6, 7.8) && x > 28, "crimson");
  drawFan(rig, { x: 29.5, y: 14.5, r: 3.6, rim: "crimson" });
  up((x, y) => within(y, 11, 14.8) && within(x, 33.5, 42 - (y - 11) * 0.4), "green", { shade: visorShade(eye) });
  up(poly([[33.5, 15.5], [41, 15], [39.5, 20.5], [33.5, 21]]), "steel", { shade: (x, y, i) => (lit(i) && x > 35.5 && oddRow(y) ? 1 : null) });
}

function drawPauldron(rig) {
  rig.up(or(ell(31, 25.5, 7.6, 5.6), poly([[25, 23.5], [29.5, 21], [21.5, 17]])), "crimson", { shade: (x, y, i) => (lit(i) && near(y, 29, 0.5) ? 1 : null) });
  drawFan(rig, { x: 31, y: 25, r: 4.2, rim: "steel" });
}

// Back to front: cables, far leg and arm, torso, near leg, head, near arm, pauldron.
// Returns where each hand ends, for whatever the hero holds.
export function heroPose(p) {
  return makeSprite(HFW, HFH, ({ part }) => {
    const rig = makeRig(part, p);
    drawCables(rig);
    drawLeg(rig, { hip: [31, 47], th: p.tB, bend: p.bB, back: true });
    const backHand = drawArm(rig, { shoulder: rig.toScreen(35, 26), a1: p.aB1, a2: p.aB2, back: true });
    rig.up(ell(36, 25, 5, 4.5), "crimsonB");
    drawChest(rig);
    drawWaist(rig);
    drawLeg(rig, { hip: [34, 47], th: p.tF, bend: p.bF, back: false });
    drawHead(rig);
    const hand = drawArm(rig, { shoulder: rig.toScreen(31, 26.5), a1: p.aF1, a2: p.aF2, back: false });
    drawPauldron(rig);
    return { hand, backHand };
  });
}

// Pose parameters, exactly as in the mockup. idle: the cables drift, the body breathes, the visor
// flares on frame 0. run: 8 frames of a forward-leaning sprint, arms pumping against the legs.
const IDLE_BOB = [0, 0, 0, 0, 1, 1, 1, 1], IDLE_WAVE = [0, 1, 1, 1, 0, -1, -1, -1];
export const IDLE_POSES = IDLE_BOB.map((bob, i) => ({
  bob, tF: 0.1, bF: 0.05, tB: -0.12, bB: 0.12, aF1: 0.1, aF2: 0.45, aB1: -0.15, aB2: 0.05,
  wave: IDLE_WAVE[i], eye: i === 0 ? 4 : 3, spin: i,
}));
const TF = [0.85, 0.55, 0.15, -0.3, -0.65, -0.5, -0.05, 0.5], BF = [0.2, 0.3, 0.6, 1.05, 1.5, 1.35, 0.85, 0.4];
const RUN_BOB = [0, 1, 1, 0, 0, 1, 1, 0], RUN_WAVE = [0, 1, 2, 1, 0, -1, -2, -1];
export const RUN_POSES = TF.map((t, i) => {
  const j = (i + 4) % 8;
  return {
    rot: 0.32, bob: RUN_BOB[i], tF: t, bF: BF[i], tB: TF[j], bB: BF[j],
    aF1: -t * 1.05, aF2: -t * 1.05 + 1.7, aB1: t * 1.05, aB2: t * 1.05 + 1.7, wave: RUN_WAVE[i], spin: i,
  };
});
export const JUMP_POSE = { rot: 0.2, tF: 1.25, bF: 1.9, tB: -0.1, bB: 1, aF1: 1.3, aF2: 2.7, aB1: -1.2, aB2: -0.3, wave: -2, spin: 2 };
export const SLASH_POSE = { rot: 0.42, bob: 1, tF: 0.95, bF: 0.45, tB: -0.7, bB: 0.8, aF1: 1.75, aF2: 1.85, aB1: -1, aB2: -0.3, wave: 2, spin: 5 };
