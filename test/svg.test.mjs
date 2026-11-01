import { test } from "node:test";
import assert from "node:assert/strict";
import { rowRuns, pathsSvg, svgDocument, escapeXml } from "../src/svg/grid.mjs";
import { flipbook, frameDelay, track } from "../src/svg/frames.mjs";
import { GLYPHS, MARKS, GLYPH_W, GLYPH_H, LINE_H, textGrid, textWidth } from "../src/svg/font.mjs";
import { checkSvg, BUDGET_BYTES } from "../src/svg/check.mjs";
import { heroPose, RUN_POSES } from "../src/sprites/hero.mjs";

// Reads our own path syntax back into a grid, so the round trip is checked by pixels, not by text.
function rasterizePaths(svg, w, h) {
  const px = new Array(w * h).fill(null);
  for (const [, fill, d] of svg.matchAll(/<path fill="([^"]+)" d="([^"]+)"\/>/g)) {
    for (const [, x, y, len] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let i = 0; i < +len; i++) {
        assert.equal(px[+y * w + +x + i], null, "runs overlap");
        px[+y * w + +x + i] = fill;
      }
    }
  }
  return px;
}

test("a row is cut into runs of one colour and empty cells are skipped", () => {
  const runs = rowRuns({ w: 5, h: 1, px: ["#a", "#a", null, "#b", "#a"] });
  assert.deepEqual(runs, [
    { x: 0, y: 0, w: 2, fill: "#a" },
    { x: 3, y: 0, w: 1, fill: "#b" },
    { x: 4, y: 0, w: 1, fill: "#a" },
  ]);
});

test("a hero frame survives grid -> paths -> grid pixel for pixel, in one path per colour", () => {
  const s = heroPose(RUN_POSES[3]);
  const svg = pathsSvg(s);
  assert.deepEqual(rasterizePaths(svg, s.w, s.h), s.px);
  const colours = new Set(s.px.filter((c) => c !== null));
  assert.equal((svg.match(/<path /g) || []).length, colours.size);
});

test("frame i is the one on screen during the i-th slot of the cycle", () => {
  // At time t a frame shows while (t - delay) mod cycle < frameS. Solve it for each slot.
  const n = 8, f = 0.1, cycle = n * f;
  for (let slot = 0; slot < n; slot++) {
    const t = slot * f + f / 2;
    const showing = [...Array(n).keys()].filter((i) => (((t - frameDelay(i, n, f)) % cycle) + cycle) % cycle < f);
    assert.deepEqual(showing, [slot]);
  }
});

test("a flipbook has its keyframes, steps(1), one group per frame, and rests on frame 0", () => {
  const frames = RUN_POSES.slice(0, 3).map(heroPose);
  const { css, body } = flipbook({ id: "run", frames, frameS: 0.1 });
  assert.match(css, /@keyframes run\{/);
  assert.match(css, /steps\(1,end\)/);
  assert.match(css, /\.run\{opacity:0;/);
  assert.match(css, /\.run-0\{opacity:1\}/);
  assert.equal((body.match(/<g class="run run-\d"/g) || []).length, 3);
});

test("a track quantises its motion with steps(n)", () => {
  const css = track({ id: "go", keys: [{ p: 0, x: 0, y: 0 }, { p: 100, x: 50.5, y: -3 }], durationS: 30, steps: 120 });
  assert.match(css, /0%\{transform:translate\(0px,0px\)\}100%\{transform:translate\(50\.5px,-3px\)\}/);
  assert.match(css, /animation:go 30s steps\(120,end\) infinite/);
});

test("every glyph is 5x7 and every mark 5x2, made only of # and .", () => {
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    assert.equal(rows.length, GLYPH_H, ch);
    for (const r of rows) assert.match(r, new RegExp(`^[#.]{${GLYPH_W}}$`), ch);
  }
  for (const rows of Object.values(MARKS)) assert.deepEqual(rows.map((r) => r.length), [GLYPH_W, GLYPH_W]);
});

test("text is laid out on a 6px advance, lowercase as uppercase, accents above the letter", () => {
  assert.equal(textWidth("HOLA"), 23);
  assert.equal(textWidth(""), 0);
  assert.deepEqual(textGrid("hola", "#f").px, textGrid("HOLA", "#f").px);
  const plain = textGrid("E", "#f"), accented = textGrid("É", "#f");
  assert.equal(accented.h, LINE_H);
  assert.deepEqual(accented.px.slice(2 * 5), plain.px.slice(2 * 5), "letter rows are unchanged");
  assert.ok(accented.px.slice(0, 2 * 5).some((c) => c === "#f"), "the accent is drawn");
  assert.ok(plain.px.slice(0, 2 * 5).every((c) => c === null));
});

test("a character with no glyph fails loudly instead of drawing a gap", () => {
  assert.throws(() => textGrid("€", "#f"), /no pixel glyph for "€"/);
});

const animated = (extra = "") =>
  svgDocument({ width: 10, height: 10, css: "@keyframes a{0%{opacity:1}}.a{animation:a 1s steps(1,end) infinite}", body: `<rect class="a" width="1" height="1"/>${extra}`, label: 'demo "x" & <y>' });

test("a document from svgDocument passes the check, escapes its label and stops under reduced motion", () => {
  const svg = animated();
  assert.deepEqual(checkSvg(svg).problems, []);
  assert.match(svg, /aria-label="demo &quot;x&quot; &amp; &lt;y&gt;"/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\{\*\{animation:none!important\}\}/);
  assert.equal(escapeXml("a&b"), "a&amp;b");
});

for (const [name, extra] of [
  ["<script", "<script>alert(1)</script>"],
  ["event handler", '<rect onload="x()"/>'],
  ["external href", '<image href="https://evil.example/a.png"/>'],
  ["external href", '<a xlink:href="//evil.example">x</a>'],
  ["@import", "<style>@import 'x.css';</style>"],
  ["remote url()", '<rect style="fill:url(https://x/y)"/>'],
  ["<foreignObject", "<foreignObject></foreignObject>"],
]) {
  test(`the check rejects ${name}: ${extra}`, () => {
    assert.deepEqual(checkSvg(animated(extra)).problems, [{ kind: "forbidden", detail: name }]);
  });
}

test("the check allows a fragment href and url(#id), which never leave the file", () => {
  assert.deepEqual(checkSvg(animated('<use href="#a"/><rect fill="url(#g)"/>')).problems, []);
});

test("the check flags an SVG that does not animate, and one over the budget", () => {
  const still = svgDocument({ width: 1, height: 1, body: "", label: "still" });
  assert.deepEqual(checkSvg(still).problems.map((p) => p.kind), ["without keyframes"]);
  assert.deepEqual(checkSvg(animated(), 100).problems.map((p) => p.kind), ["over budget"]);
  assert.ok(BUDGET_BYTES < 1_070_982, "the budget stays under the size the spike saw working");
});
