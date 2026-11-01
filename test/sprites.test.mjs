// The canvas-free sprites must be identical, pixel for pixel, to what the approved mockup drew.
// GOLDEN was captured once from the mockup's own code (hero.js, level3.js) running against a fake
// canvas that recorded every fillRect: [width, height, sha256 of the grid, hand, backHand].
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeSprite, OUTC } from "../src/sprites/raster.mjs";
import { heroPose, IDLE_POSES, RUN_POSES, JUMP_POSE, SLASH_POSE } from "../src/sprites/hero.mjs";
import { ENEMIES } from "../src/sprites/enemies.mjs";

const GOLDEN = {
  "idle0": [64, 80, "5f66d45ca663838aa9867c9be879c10c5e6f53bc6790f4b4d205509f75a0ff07", [36.030673, 44.009285], [34.129859, 44.387067]],
  "idle1": [64, 80, "a667c72bb2993f75c4531f3f65b2e803a5a4da69356b7c0bf81b0efec1914157", [36.030673, 44.009285], [34.129859, 44.387067]],
  "idle2": [64, 80, "8bc461aec9fe18b989f6c3fdf52a6f39fc311d9fcc01398f5ceb8062cf2641bd", [36.030673, 44.009285], [34.129859, 44.387067]],
  "idle3": [64, 80, "bad518dd7e2d4c21360f79adf6fa4710daef1d365a1b402708e873c49e302e65", [36.030673, 44.009285], [34.129859, 44.387067]],
  "idle4": [64, 80, "652c3a56e83b1fa3b1651f070fba06943bc4bb6e956049efd38b7df460622db0", [36.030673, 45.009285], [34.129859, 45.387067]],
  "idle5": [64, 80, "861fa62c8ea345051cf1fbfaf0656ee68fb6b7b05b60b9e74424d247adee2960", [36.030673, 45.009285], [34.129859, 45.387067]],
  "idle6": [64, 80, "d6d901d268e52a53891eaa6cdf03c4ca5a8df8a3ce483c28640412f996ac8d42", [36.030673, 45.009285], [34.129859, 45.387067]],
  "idle7": [64, 80, "4fc27733a388d141891f1890b141bf6a58877a4fb260a1ea936f7792ed5ae5c6", [36.030673, 45.009285], [34.129859, 45.387067]],
  "run0": [64, 80, "00d679412caa178d5abc0ed6b5df767f1357e7bcb7b908a29cbbcee9c42c4202", [37.092123, 39.075399], [53.155766, 25.188146]],
  "run1": [64, 80, "e9e15354c6db2e2685de00a16408db4ec5c432c14d991745b0ce51cbc2879752", [40.883472, 39.51884], [53.327993, 30.016257]],
  "run2": [64, 80, "c434215564e14fe9dbd247e045396069a29549f7992f457fc4668413c3bcbe90", [45.320127, 37.018158], [51.713671, 34.846503]],
  "run3": [64, 80, "7f712cdc3217d5c3dd6cac1056e3627858841fbd299359c27777f621cff8c908", [48.60198, 31.335423], [47.737954, 37.95652]],
  "run4": [64, 80, "e4e3650952ff2e6a20127678ff75ef0634710f0e916d12b6a98b38479f5ed3a4", [49.450695, 26.952883], [43.595758, 39.620608]],
  "run5": [64, 80, "868366586a2e8cb9f701139f47490965288357a2b32e4e129f58b16932b83854", [49.285055, 29.86768], [45.444438, 40.094999]],
  "run6": [64, 80, "b46cf1d1d5cce70c422ce7a4b1d356780ce045069b0494ca19efb985a58c8079", [47.051464, 35.131674], [50.189586, 36.904054]],
  "run7": [64, 80, "adfebaf68c12ce46e7a0d2b6de751b719f8284f4f2cfc1ef19d9efcfb6f09d05", [41.490214, 38.311351], [53.23928, 29.651329]],
  "jump": [64, 80, "73ec078888620f362b5460755086cddd02aa73bccb057be3f0b3e859df62a2e5", [47.646051, 20.310167], [27.737726, 39.132924]],
  "slash": [64, 80, "26d80f513f066481fed51d9323666ec7968d52c1dc05456748e850895a5ea775", [57.113139, 24.156923], [32.600706, 43.492159]],
  "enemy-bug0": [26, 18, "6601ed09f227c07658c1b4e50b6020e36a265f3a46d6858351cb0478076cf5f7"],
  "enemy-bug1": [26, 18, "07e4ec52f152befd52a3d97bf22e25006bea8a6d5a5e9791c20efe38052375f0"],
  "enemy-fan-spike0": [24, 24, "28cd23b9ac84cf100f2de57d7b7d4bf6ff23dc02b72c82522d7f3e96e28b4bd5"],
  "enemy-fan-spike1": [24, 24, "d471d8bf8fb33343f5e329745e9fffee9b8dc6b6d07445e8b9a0203f5f4401f9"],
  "enemy-oom0": [24, 20, "dac081195a983c7e48026d968f983f76666ae395d7aef3672ff166d51bf83092"],
  "enemy-oom1": [24, 20, "21cacdea4d823b2068a9e9debf584563c66681c8d73c2f2ecf6f144d494651db"],
  "enemy-nan0": [22, 22, "df24fb7976eba0e4458fccb33b037e130e30ae1373d5b42d0c935cace267f6e0"],
  "enemy-nan1": [22, 22, "31cf00538beec7567912f3af2dd26d32b5242b702acf7fb9e289fbb7302e7184"],
};

// Same serialisation the golden was hashed with: rows of comma-joined colours, "." for empty.
const gridHash = ({ w, h, px }) => {
  const rows = [];
  for (let y = 0; y < h; y++) rows.push(px.slice(y * w, y * w + w).map((c) => c ?? ".").join(","));
  return createHash("sha256").update(rows.join("\n")).digest("hex");
};

const sprites = {};
IDLE_POSES.forEach((p, i) => (sprites["idle" + i] = heroPose(p)));
RUN_POSES.forEach((p, i) => (sprites["run" + i] = heroPose(p)));
sprites.jump = heroPose(JUMP_POSE);
sprites.slash = heroPose(SLASH_POSE);
ENEMIES.forEach((e) => e.frames.forEach((s, i) => (sprites[`enemy-${e.name.replace(/\s/g, "-").toLowerCase()}${i}`] = s)));

test("every golden sprite is produced, and nothing extra", () => {
  assert.deepEqual(Object.keys(sprites).sort(), Object.keys(GOLDEN).sort());
});

for (const [name, [w, h, sha, hand, backHand]] of Object.entries(GOLDEN)) {
  test(`${name} matches the mockup pixel for pixel`, () => {
    const s = sprites[name];
    assert.equal(s.w, w);
    assert.equal(s.h, h);
    assert.equal(s.px.length, w * h);
    assert.equal(gridHash(s), sha);
    if (hand) {
      assert.deepEqual(s.hand.map((n) => +n.toFixed(6)), hand);
      assert.deepEqual(s.backHand.map((n) => +n.toFixed(6)), backHand);
    }
  });
}

test("a pixel outside every part but next to one is the outline colour", () => {
  const s = makeSprite(5, 5, ({ part }) => part((x, y) => x > 2 && x < 3 && y > 2 && y < 3, "green"));
  assert.equal(s.px[2 * 5 + 2] !== null, true);
  assert.equal(s.px[1 * 5 + 2], OUTC);
  assert.equal(s.px[0], null);
});

test("an unknown palette name fails loudly instead of drawing undefined", () => {
  assert.throws(() => makeSprite(3, 3, ({ part }) => part(() => true, "no-such-ramp")));
});
