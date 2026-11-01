// The level as one animated SVG: the race from simulate.mjs replayed with CSS. Every moving
// thing is a group whose opacity or position changes on whole ticks (steps(1,end)), all on the
// same loop, so they stay in step. With motion off, the hero stands on column 20, every enemy
// is alive and the counter reads zero.
//
//   node src/level/render.mjs            fetch the real calendar (needs GITHUB_TOKEN), write out/level.svg
//   node src/level/render.mjs --sample   use data/contrib.sample.json instead
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { svgDocument, pathsSvg, placed } from "../svg/grid.mjs";
import { fmt } from "../svg/frames.mjs";
import { textSvg, textWidth } from "../svg/font.mjs";
import { heroPose, RUN_POSES, JUMP_POSE, SLASH_POSE, FEET } from "../sprites/hero.mjs";
import { ENEMIES } from "../sprites/enemies.mjs";
import { withBlade } from "../panels.mjs";
import { simulate, restingSpot, STAGE, SLASH_BUCKETS } from "./simulate.mjs";
import { parseCalendar, weekHeights, fetchCalendar } from "../contrib.mjs";

// One physics tick per display frame, as the approved mockup stepped it with requestAnimationFrame:
// the speed, gravity and frame counts in simulate.mjs are per 1/60 s. Playing them at 24/s made the
// published level 2.5x slower than the mockup; a run of the real year is now ~11 s.
export const TICK_S = 1 / 60;
const LEVELS = ["#141f4a", "#1e3a5f", "#1f6f5c", "#2bb57f", "#3dffa2", "#3dffa2", "#3dffa2"];
const BURST = ["#ffffff", "#f2b134", "#ff8a3d"];

// ---- timeline helpers
// Merged [from, to) tick spans where keep(tick) holds.
export function spansOf(ticks, keep) {
  const spans = [];
  ticks.forEach((t, i) => {
    if (!keep(t, i)) return;
    const last = spans[spans.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else spans.push([i, i + 1]);
  });
  return spans;
}

// Opacity 1 inside the spans and 0 outside, over a loop of n ticks.
function visibleDuring(cls, spans, n) {
  const pct = (t) => fmt((100 * t) / n);
  const changes = spans.flatMap(([a, b]) => [[a, 1], [b, 0]]).filter(([t]) => t > 0 && t < n);
  const first = spans.length > 0 && spans[0][0] === 0 ? 1 : 0;
  const last = spans.length > 0 && spans[spans.length - 1][1] >= n ? 1 : 0;
  const frames = [`0%{opacity:${first}}`, ...changes.map(([t, v]) => `${pct(t)}%{opacity:${v}}`), `100%{opacity:${last}}`];
  return `@keyframes ${cls}{${frames.join("")}}.${cls}{animation:${cls} ${fmt(n * TICK_S)}s steps(1,end) infinite}`;
}

const group = (cls, inner, restOpacity) => `<g class="${cls}"${restOpacity === 1 ? "" : ` opacity="0"`}>${inner}</g>`;
const rectsPath = (fill, rects, extra = "") =>
  `<path fill="${fill}"${extra} d="${rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join("")}"/>`;

// ---- terrain: one column per week, a block per height step
function columnBlocks(land, i, out) {
  const x0 = Math.round(i * land.cw) + 1, w = Math.round((i + 1) * land.cw) - Math.round(i * land.cw) - 2;
  for (let k = 0; k < land.heights[i]; k++) {
    const y0 = STAGE.ground - (k + 1) * STAGE.block + 1, h = STAGE.block - 2;
    (out.blocks[LEVELS[Math.min(6, k + 1)]] ??= []).push([x0, y0, w, h]);
    out.light.push([x0, y0, w, 1]);
    out.shade.push([x0, y0 + h - 1, w, 1]);
  }
  out.ground.push([Math.round(i * land.cw), STAGE.ground, Math.round(land.cw) - 1, 3]);
}

export function terrainSvg(land) {
  const out = { blocks: {}, light: [], shade: [], ground: [] };
  land.heights.forEach((_, i) => columnBlocks(land, i, out));
  const lines = [];
  for (let y = STAGE.ground; y > 0; y -= STAGE.block) lines.push([0, y, STAGE.width, 1]);
  return (
    rectsPath("#111836", lines) +
    Object.entries(out.blocks).map(([fill, rects]) => rectsPath(fill, rects)).join("") +
    rectsPath("#ffffff", out.light, ' fill-opacity=".22"') + rectsPath("#000000", out.shade, ' fill-opacity=".18"') +
    rectsPath("#25326a", out.ground)
  );
}

// ---- hero: twelve pose groups inside one group that follows the race
const PAD = 32, BLADE_LEN = 28, SWING_FROM = -2.1, SWING = 2.7;

function padded(sprite) {
  const w = sprite.w + 2 * PAD, h = sprite.h + 2 * PAD, px = new Array(w * h).fill(null);
  sprite.px.forEach((c, k) => {
    px[(Math.floor(k / sprite.w) + PAD) * w + (k % sprite.w) + PAD] = c;
  });
  return { ...sprite, w, h, px, hand: [sprite.hand[0] + PAD, sprite.hand[1] + PAD] };
}

// The swept arc behind the blade, as in the mockup: a translucent pie from the raised blade.
function swing([hx, hy], angle) {
  const r = BLADE_LEN + 2, p = (a) => `${fmt(hx + Math.cos(a) * r)} ${fmt(hy + Math.sin(a) * r)}`;
  return `<path fill="#ff9632" fill-opacity=".3" d="M${hx} ${hy}L${p(SWING_FROM)}A${r} ${r} 0 0 1 ${p(angle)}z"/>`;
}

function slashFrame(bucket) {
  const angle = SWING_FROM + SWING * ((bucket * 4 + 2) / 18);
  const sprite = withBlade(padded(heroPose(SLASH_POSE)), { angle, length: BLADE_LEN });
  return placed({ x: -PAD, y: -PAD }, swing(sprite.hand, angle) + pathsSvg(sprite));
}

export function poseFrames() {
  const frames = { jump: pathsSvg(heroPose(JUMP_POSE)) };
  RUN_POSES.forEach((p, i) => (frames[`run${i}`] = pathsSvg(heroPose(p))));
  for (let b = 0; b < SLASH_BUCKETS; b++) frames[`slash${b}`] = slashFrame(b);
  return frames;
}

function heroTrack(ticks, rest) {
  const n = ticks.length, keys = [];
  let prev = "";
  ticks.forEach((t, i) => {
    const at = `translate(${Math.round(t.x)}px,${Math.round(t.y) - FEET}px)`;
    if (at !== prev) keys.push(`${fmt((100 * i) / n)}%{transform:${at}}`);
    prev = at;
  });
  return (
    `@keyframes hero{${keys.join("")}100%{transform:${prev}}}` +
    `.hero{transform:translate(${Math.round(rest.x)}px,${Math.round(rest.y) - FEET}px);animation:hero ${fmt(n * TICK_S)}s steps(1,end) infinite}`
  );
}

function heroSvg(sim) {
  const n = sim.ticks.length;
  let css = heroTrack(sim.ticks, restingSpot(sim.land)), body = "";
  for (const [pose, inner] of Object.entries(poseFrames())) {
    css += visibleDuring(`p-${pose}`, spansOf(sim.ticks, (t) => t.pose === pose), n);
    body += group(`p-${pose}`, inner, pose === "run0" ? 1 : 0);
  }
  return { css, body: `<g class="hero">${body}</g>` };
}

// ---- enemies: alive until their tick, then a short burst and their name
const ENEMY_FRAME_S = 14 * TICK_S;
const ENEMY_CSS =
  "@keyframes alt{0%{opacity:1}50%{opacity:0}100%{opacity:0}}" +
  `.fa{animation:alt ${fmt(2 * ENEMY_FRAME_S)}s steps(1,end) infinite}` +
  `.fb{opacity:0;animation:alt ${fmt(2 * ENEMY_FRAME_S)}s steps(1,end) ${fmt(-ENEMY_FRAME_S)}s infinite}`;

function enemyBody(e) {
  const kind = ENEMIES[e.type], [f0, f1] = kind.frames;
  const at = { x: Math.round(e.x - f0.w / 2), y: e.top - f0.h - (kind.hover ? 12 : 0) };
  return placed(at, `<g class="fa">${pathsSvg(f0)}</g><g class="fb">${pathsSvg(f1)}</g>`);
}

function burstFrame(e, t) {
  const cy = e.top - 10, r = t * 0.9, parts = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2, size = k % 2 ? 2 : 3;
    parts.push(`<rect x="${Math.round(e.x + Math.cos(a) * r) - 1}" y="${Math.round(cy + Math.sin(a) * r) - 1}" width="${size}" height="${size}" fill="${BURST[k % 3]}"/>`);
  }
  const flash = t < 6 ? `<circle cx="${fmt(e.x)}" cy="${cy}" r="${11 - t}" fill="#ffffff"/>` : "";
  const name = `${ENEMIES[e.type].name} ×`;
  const label = textSvg(name, { x: Math.round(e.x - textWidth(name)), y: Math.round(e.top - 37 - t * 0.5), scale: 2, colour: "#ff8d98" });
  return `<g opacity="${fmt(1 - t / 40)}">${parts.join("")}${flash}${label}</g>`;
}

const BURST_STEPS = [0, 3, 10, 20, 30, 40];
function burstSvg(e, j, n) {
  let css = "", body = "";
  for (let s = 0; s < BURST_STEPS.length - 1; s++) {
    const cls = `b${j}-${s}`, from = e.killedAt + BURST_STEPS[s], to = Math.min(n, e.killedAt + BURST_STEPS[s + 1]);
    if (from >= n) break;
    css += visibleDuring(cls, [[from, to]], n);
    body += group(cls, burstFrame(e, BURST_STEPS[s] + 1), 0);
  }
  return { css, body };
}

function enemiesSvg(sim) {
  const n = sim.ticks.length;
  let css = ENEMY_CSS, body = "";
  sim.enemies.forEach((e, j) => {
    if (e.killedAt === undefined) return void (body += enemyBody(e));
    css += visibleDuring(`e${j}`, [[0, e.killedAt]], n);
    body += group(`e${j}`, enemyBody(e), 1);
    const burst = burstSvg(e, j, n);
    css += burst.css;
    body += burst.body;
  });
  return { css, body };
}

// ---- HUD: the year's total on the left, enemies cut down so far on the right
function counterSvg(sim) {
  const n = sim.ticks.length, kills = sim.enemies.map((e) => e.killedAt).filter((t) => t !== undefined).sort((a, b) => a - b);
  const bounds = [0, ...kills, n];
  let css = "", body = "";
  for (let c = 0; c < bounds.length - 1; c++) {
    const text = `ENEMIES: ${c}`;
    css += visibleDuring(`k${c}`, [[bounds[c], bounds[c + 1]]], n);
    body += group(`k${c}`, textSvg(text, { x: STAGE.width - 6 - textWidth(text) * 2, y: 4, scale: 2, colour: "#f2b134" }), c === 0 ? 1 : 0);
  }
  return { css, body };
}

export function levelSvg({ total, weeks }, { sample = false } = {}) {
  const sim = simulate(weekHeights(weeks));
  const title = `LAST YEAR · ${total} CONTRIBUTIONS${sample ? " (SAMPLE)" : ""}`;
  const parts = [heroSvg(sim), enemiesSvg(sim), counterSvg(sim)];
  const body =
    `<rect width="${STAGE.width}" height="${STAGE.height}" fill="#0a0f24"/>` + terrainSvg(sim.land) +
    parts[1].body + parts[0].body + textSvg(title, { x: 6, y: 4, scale: 2, colour: "#8f9bc8" }) + parts[2].body;
  return {
    sim,
    svg: svgDocument({
      width: STAGE.width, height: STAGE.height, css: parts.map((p) => p.css).join(""), body,
      label: `The last year of contributions (${total}${sample ? ", sample data" : ""}) turned into a platform level the reploid runs through, slashing enemies`,
    }),
  };
}

// ---- CLI
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function calendar(sample) {
  if (sample) return parseCalendar(JSON.parse(readFileSync(join(ROOT, "data", "contrib.sample.json"), "utf8")));
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set (use --sample to build from the sample data)");
  return fetchCalendar(process.env.LOGIN || "TheSOV", token);
}

async function main(argv) {
  const sample = argv.includes("--sample");
  const { svg, sim } = levelSvg(await calendar(sample), { sample });
  mkdirSync(join(ROOT, "out"), { recursive: true });
  writeFileSync(join(ROOT, "out", "level.svg"), svg);
  const kills = sim.enemies.filter((e) => e.killedAt !== undefined).length;
  console.log(`level.svg ${Buffer.byteLength(svg)} bytes, ${sim.ticks.length} ticks (${fmt(sim.ticks.length * TICK_S)} s), ${kills}/${sim.enemies.length} enemies`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`level not built: ${e.message}`);
    process.exitCode = 1;
  });
}
