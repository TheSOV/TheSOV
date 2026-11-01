// The fixed panels of the profile README, one SVG each, drawn from data/profile.json to match
// the approved mockup (v9). Pure: data in, SVG text out; scripts/build.mjs writes the files.
// All text is the pixel font, all motion is CSS with steps(), and every panel rests on a
// sensible still frame when reduced motion turns animation off.
import { deflateSync, crc32 } from "node:zlib";
import { svgDocument, pathsSvg, placed, escapeXml } from "./svg/grid.mjs";
import { frameDelay, fmt } from "./svg/frames.mjs";
import { textSvg, textWidth } from "./svg/font.mjs";
import { heroPose, IDLE_POSES } from "./sprites/hero.mjs";

export const W = 900;
const LINE = 22; // pixel-font text at scale 2, line to line
const C = {
  bg: "#0a0f24", panel: "#10183a", panel2: "#141f4a", line: "#25326a", fg: "#e8ecff", muted: "#8f9bc8",
  crimson: "#d7263d", crimsonD: "#7a1020", gold: "#f2b134", saber: "#3dffa2", cyan: "#4cc9f0", demon: "#ff5c77",
};
// The hero's heat blade; the header cut is the same blade, so it shares these colours.
const BLADE = { edge: "#c0501a", glow: "#ff9a3d", core: "#fff2d6" };
const CHIP = { gpu: "#3dffa2", lab: "#4cc9f0", inf: "#a78bfa", train: "#f2b134", elec: "#f97316", fab: "#d7263d", code: "#e8ecff" };

// ---- small builders
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}="${v}"`).join(" ");
const el = (tag, o, inner = "") => (inner ? `<${tag} ${attrs(o)}>${inner}</${tag}>` : `<${tag} ${attrs(o)}/>`);
const box = ({ x = 0, y = 0, w, h, ...rest }) => el("rect", { x, y, width: w, height: h, ...rest });

// Text whose letter rows (below the two accent rows) are centred on midY.
const textTop = (midY, scale) => Math.round(midY - 5.5 * scale);
const label = (text, { x, midY, scale = 2, colour, cls }) => {
  const t = textSvg(text, { x: Math.round(x), y: textTop(midY, scale), scale, colour });
  return cls ? `<g class="${cls}">${t}</g>` : t;
};
const centred = (text, o) => label(text, { ...o, x: o.cx - (textWidth(text) * (o.scale ?? 2)) / 2 });

// Greedy word wrap to a number of characters per line.
export function wrap(text, perLine) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    const joined = last < 0 ? word : `${lines[last]} ${word}`;
    if (last >= 0 && joined.length <= perLine) lines[last] = joined;
    else lines.push(word);
  }
  return lines;
}

const blink = (cls, seconds) => `@keyframes ${cls}{50%{opacity:0}}.${cls}{animation:${cls} ${seconds}s steps(1,end) infinite}`;

// One item visible at a time, rotating every itemS; item 0 is the still frame.
function rotation(id, items, itemS) {
  const n = items.length;
  const css =
    `@keyframes ${id}{0%{opacity:1}${fmt(100 / n)}%{opacity:0}100%{opacity:0}}` +
    `.${id}{opacity:0;animation:${id} ${fmt(itemS * n)}s steps(1,end) infinite}.${id}-0{opacity:1}` +
    items.map((_, i) => `.${id}-${i}{animation-delay:${fmt(frameDelay(i, n, itemS))}s}`).join("");
  const body = items.map((svg, i) => `<g class="${id} ${id}-${i}">${svg}</g>`).join("");
  return { css, body };
}

const doc = (name, { height, css, body, alt }) => ({ name, alt, svg: svgDocument({ width: W, height, css, body, label: alt }) });

// ---- header: READY blinks, a saber cut crosses the screen, the name appears
const HEADER_CSS =
  "@keyframes ready{0%,30%,60%{opacity:1}15%,45%,75%{opacity:0}90%{opacity:1}100%{opacity:0}}" +
  ".ready{opacity:0;animation:ready 2.2s steps(1,end) both}" +
  "@keyframes appear{from{opacity:0}to{opacity:1}}" +
  ".name{animation:appear .4s steps(4,end) 2.2s both}.sub{animation:appear .4s steps(4,end) 2.6s both}" +
  "@keyframes cut{from{stroke-dashoffset:1100}to{stroke-dashoffset:0}}" +
  ".cut{stroke-dasharray:1100;fill:none;stroke-linecap:round;animation:cut .35s cubic-bezier(.2,.8,.2,1) 1.95s both}";

const GLOW = '<filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';

export function headerPanel({ name, ready, sub }) {
  const h = 220;
  const defs = `<defs>${GLOW}<radialGradient id="sky" cx="50%" cy="0%" r="120%"><stop offset="0" stop-color="#17245c"/><stop offset=".7" stop-color="${C.bg}"/></radialGradient></defs>`;
  const ground = [180, 196, 210].map((y) => el("line", { x1: 0, y1: y, x2: W, y2: y })).join("");
  const body =
    defs + box({ w: W, h, fill: "url(#sky)" }) +
    `<g stroke="${C.line}" opacity=".5">${ground}</g>` +
    centred(ready, { cx: W / 2, midY: 104, scale: 5, colour: C.gold, cls: "ready" }) +
    el("path", { class: "cut", d: "M60 190 L840 30", stroke: BLADE.glow, "stroke-width": 5, filter: "url(#glow)" }) +
    el("path", { class: "cut", d: "M60 190 L840 30", stroke: BLADE.core, "stroke-width": 1.6 }) +
    centred(name, { cx: W / 2, midY: 100, scale: 8, colour: C.fg, cls: "name" }) +
    centred(sub, { cx: W / 2, midY: 152, scale: 2, colour: C.muted, cls: "sub" });
  return doc("header.svg", { height: h, css: HEADER_CSS, body, alt: `${ready}, un corte de sable cruza la pantalla y aparece ${name}: ${sub}` });
}

// ---- stage select: a 3x3 grid, the hero idling in the middle with his heat blade
const ICONS = {
  gpu: '<rect x="3" y="10" width="34" height="18" rx="2" fill="#141f4a"/><circle cx="13" cy="19" r="6"/><circle cx="27" cy="19" r="6"/><path d="M13 13v12M7 19h12M27 13v12M21 19h12" stroke-width="1"/><path d="M8 28v5M14 28v5M20 28v5M26 28v5" stroke="#f2b134"/>',
  lab: '<rect x="7" y="4" width="26" height="9" rx="1"/><rect x="7" y="15" width="26" height="9" rx="1"/><rect x="7" y="26" width="26" height="9" rx="1"/><circle cx="12" cy="8.5" r="1.4" fill="#3dffa2" stroke="none"/><circle cx="12" cy="19.5" r="1.4" fill="#3dffa2" stroke="none"/><circle cx="12" cy="30.5" r="1.4" fill="#f2b134" stroke="none"/><path d="M18 8.5h11M18 19.5h11M18 30.5h11" stroke-width="1"/>',
  inf: '<circle cx="8" cy="12" r="3"/><circle cx="8" cy="28" r="3"/><circle cx="20" cy="20" r="3"/><circle cx="32" cy="12" r="3"/><circle cx="32" cy="28" r="3"/><path d="M11 13l6 5M11 27l6-5M23 19l6-5M23 21l6 5" stroke-width="1.4"/><path d="M2 36h36" stroke="#3dffa2"/><path d="M33 33l4 3-4 3" stroke="#3dffa2"/>',
  ag: '<rect x="4" y="6" width="12" height="10" rx="2"/><rect x="24" y="6" width="12" height="10" rx="2"/><rect x="14" y="24" width="12" height="10" rx="2" stroke="#3dffa2"/><path d="M10 16v4h20v-4M20 20v4" stroke-width="1.4"/><circle cx="8" cy="11" r="1.2" fill="#f2b134" stroke="none"/><circle cx="28" cy="11" r="1.2" fill="#f2b134" stroke="none"/>',
  elec: '<path d="M2 20h7l3-7 5 14 5-14 5 14 3-7h8"/><circle cx="2" cy="20" r="1.5" fill="#f2b134" stroke="none"/><circle cx="38" cy="20" r="1.5" fill="#f2b134" stroke="none"/>',
  fab: '<rect x="13" y="3" width="14" height="8" rx="1"/><path d="M17 11l3 6 3-6"/><path d="M8 24h24M6 28h28M5 32h30" stroke="#f2b134"/><path d="M4 36h32" stroke-width="1"/>',
  train: '<path d="M4 35V5M4 35h33" stroke-width="1.4"/><path d="M6 10c5 0 6 14 11 16s9 4 18 5" stroke="#f2b134"/><path d="M6 8c4 6 8 2 10 9s8 7 19 9" stroke-width="1" stroke-dasharray="2 2"/>',
  cross: '<circle cx="15" cy="15" r="9" stroke="#d7263d"/><circle cx="25" cy="15" r="9" stroke="#4cc9f0"/><circle cx="20" cy="24" r="9" stroke="#f2b134"/><circle cx="20" cy="18" r="2.4" fill="#3dffa2" stroke="none"/>',
};
const icon = (id, { x, y, size }) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" stroke="${C.fg}" stroke-width="2" shape-rendering="geometricPrecision">${ICONS[id]}</svg>`;

// The heat blade the mockup drew with canvas strokes, as pixels: hilt, then the blade from the
// outer glow in, each layer a distance from the same segment.
const BLADE_LAYERS = [[BLADE.edge, 2], [BLADE.glow, 1.2], [BLADE.core, 0.5]];
const distToSegment = (px, py, [ax, ay, bx, by]) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};
function bladeColour(x, y, { blade, hilt }) {
  let colour = distToSegment(x, y, hilt) <= 1 ? "#c0841a" : null;
  for (const [c, r] of BLADE_LAYERS) if (distToSegment(x, y, blade) <= r) colour = c;
  return colour;
}
export function withBlade(sprite, { angle = 1.2, length = 24 } = {}) {
  const [hx, hy] = sprite.hand, dx = Math.cos(angle), dy = Math.sin(angle);
  const geom = { blade: [hx + dx * 3, hy + dy * 3, hx + dx * length, hy + dy * length], hilt: [hx - dx * 2, hy - dy * 2, hx + dx * 3, hy + dy * 3] };
  const px = sprite.px.map((c, k) => bladeColour((k % sprite.w) + 0.5, Math.floor(k / sprite.w) + 0.5, geom) ?? c);
  return { ...sprite, px };
}

const TILE = { w: 284, h: 120 };

function playerTile({ x, y }) {
  const frames = IDLE_POSES.map((p) => withBlade(heroPose(p)));
  // The mockup changed pose every 10 display frames: 1/6 s.
  const idle = rotation("idle", frames.map(pathsSvg), 1 / 6);
  const body =
    box({ x, y, w: TILE.w, h: TILE.h, rx: 4, fill: "url(#me)", stroke: C.gold, "stroke-width": 2 }) +
    placed({ x: x + TILE.w / 2 - 33, y: y + 6 }, idle.body) +
    centred("PLAYER 1", { cx: x + TILE.w / 2, midY: y + 104, colour: C.muted });
  return { css: idle.css, body };
}

function cursorCorners({ x, y }) {
  const tl = `M${x - 6} ${y + 4}V${y - 6}H${x + 4}`, br = `M${x + TILE.w + 6} ${y + TILE.h - 4}V${y + TILE.h + 6}H${x + TILE.w - 4}`;
  return el("path", { class: "cursor", d: tl + br, fill: "none", stroke: C.gold, "stroke-width": 2 });
}

function stageTile(st, at) {
  const { x, y } = at, cx = x + TILE.w / 2, dim = st.locked ? ' opacity=".45"' : "";
  const frame = st.locked
    ? box({ x, y, w: TILE.w, h: TILE.h, rx: 4, fill: "none", stroke: C.line, "stroke-width": 2, "stroke-dasharray": "6 4" })
    : box({ x, y, w: TILE.w, h: TILE.h, rx: 4, fill: C.panel2, stroke: st.selected ? C.crimson : C.line, "stroke-width": 2 });
  const titleColour = st.id === "cross" ? C.saber : C.fg;
  const parts = [
    frame,
    st.selected ? box({ x: x + 3, y: y + 3, w: TILE.w - 6, h: TILE.h - 6, rx: 2, fill: "none", stroke: C.crimsonD, "stroke-width": 2 }) : "",
    `<g${dim}>${icon(st.id, { x: cx - 19, y: y + 16, size: 38 })}${centred(st.title, { cx, midY: y + 76, colour: titleColour })}</g>`,
    centred(st.sub, { cx, midY: y + 98, colour: st.locked ? C.gold : C.muted }),
    st.selected ? cursorCorners(at) : "",
  ];
  return parts.join("");
}

// The stage select is nine images in a README table, one per tile, so each can be the <summary>
// of its own <details>: clicking a stage opens its sheet, as the mockup's buttons did, with no JS.
// Each tile is padded so the selection cursor, drawn outside the frame, still fits.
const TILE_PAD = 8;
const TILE_AT = { x: TILE_PAD, y: TILE_PAD };
const ME_GRADIENT = '<defs><linearGradient id="me" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1240"/><stop offset="1" stop-color="#2a0f22"/></linearGradient></defs>';
const tileFile = (st) => `stage-${st.id}.svg`;

// A small blinking arrow in the corner: this tile opens.
const openHint = ({ x, y }) =>
  el("path", { class: "hint", d: `M${x + TILE.w - 22} ${y + TILE.h - 16}h12l-6 7z`, fill: C.gold });

function tileDoc(st) {
  const size = { width: TILE.w + 2 * TILE_PAD, height: TILE.h + 2 * TILE_PAD };
  if (st.id === "me") {
    const p = playerTile(TILE_AT);
    return { name: tileFile(st), alt: "Player 1: el reploide en reposo con su hoja térmica", svg: svgDocument({ ...size, css: p.css, body: ME_GRADIENT + p.body, label: "Player 1" }) };
  }
  const alt = `${st.title}: ${st.sub}${st.locked ? " (bloqueado)" : ""}. Pulsa para ver la zona`;
  const css = blink("hint", 1) + blink("cursor", 1);
  return { name: tileFile(st), alt, svg: svgDocument({ ...size, css, body: stageTile(st, TILE_AT) + openHint(TILE_AT), label: alt }) };
}

function stageHead() {
  const h = 36, prompt = "PULSA UN STAGE";
  const body =
    label("STAGE SELECT", { x: 16, midY: 18, colour: C.gold }) +
    label(prompt, { x: W - 16 - textWidth(prompt) * 2, midY: 18, colour: C.muted, cls: "prompt" });
  return doc("stage-head.svg", { height: h, css: blink("prompt", 1.4), body, alt: "Stage select: pulsa un stage para ver su zona, su jefe y sus repos" });
}

export const stagePanels = (stages) => [stageHead(), ...stages.map(tileDoc)];

// ---- the README table around those tiles
const LOCKED_REPOS = "Todavía no hay ninguno. Este stage se desbloquea con el primer repo.";
const TILE_IMG_WIDTH = TILE.w + 2 * TILE_PAD;

// <picture> keeps GitHub from wrapping the image in a link to the SVG, which would take the click
// away from the <summary>.
const tileImg = (st, alt) => `<picture><img src="assets/${tileFile(st)}" width="${TILE_IMG_WIDTH}" alt="${escapeXml(alt)}"></picture>`;
const repoLinks = (st, login) =>
  st.repos.length === 0 ? `<i>${LOCKED_REPOS}</i>` : st.repos.map((r) => `<a href="https://github.com/${login}/${r}">${escapeXml(r)}</a>`).join("<br>");

function stageCell(st, login) {
  const { alt } = tileDoc(st);
  // A fixed third per column: an open sheet would otherwise widen its column and shrink the rest.
  if (st.id === "me") return `<td width="33%" align="center">${tileImg(st, alt)}</td>`;
  const sheet = [["ZONA", escapeXml(st.zone)], ["JEFE", escapeXml(st.boss)], ["REPOS", repoLinks(st, login)]]
    .map(([k, v]) => `<b>${k}</b><br>${v}`).join("<br><br>");
  return `<td width="33%" valign="top"><details><summary>${tileImg(st, alt)}</summary><br>${sheet}</details></td>`;
}

export const STAGE_TABLE_START = "<!-- stage-select:start (generated by scripts/build.mjs from data/profile.json) -->";
export const STAGE_TABLE_END = "<!-- stage-select:end -->";

export function stageTable(stages, login) {
  const rows = [0, 3, 6].map((i) => `<tr>\n${stages.slice(i, i + 3).map((st) => `  ${stageCell(st, login)}`).join("\n")}\n</tr>`);
  return `<p align="center"><img src="assets/stage-head.svg" width="900" alt="${escapeXml(stageHead().alt)}"></p>\n\n<table align="center">\n${rows.join("\n")}\n</table>`;
}

// The README with its stage-select block regenerated; everything outside the markers is untouched.
export function withStageTable(readme, stages, login) {
  const start = readme.indexOf(STAGE_TABLE_START), end = readme.indexOf(STAGE_TABLE_END);
  if (start < 0 || end < start) throw new Error("README.md has no stage-select markers");
  return readme.slice(0, start + STAGE_TABLE_START.length) + "\n" + stageTable(stages, login) + "\n" + readme.slice(end);
}

// ---- warning: striped bands, a blinking title, one line at a time of what is going on
function stripeBand(y, cls) {
  const shapes = [];
  for (let x = -56; x < W + 28; x += 28) shapes.push(`M${x} ${y + 16}h14l16-16h-14z`);
  return `<g class="${cls}">${el("path", { d: shapes.join(""), fill: C.crimson })}</g>`;
}

export function warningPanel({ label: now, lines, lineSeconds }) {
  const h = 150;
  const rot = rotation("w", lines.map((t) => centred(t, { cx: W / 2, midY: 106, colour: C.fg })), lineSeconds);
  const css =
    "@keyframes stripes{from{transform:translateX(0)}to{transform:translateX(28px)}}.stripes{animation:stripes .84s steps(7,end) infinite}" +
    blink("title", 1.1) + rot.css;
  const body =
    `<defs><clipPath id="panel"><rect width="${W}" height="${h}" rx="6"/></clipPath></defs><g clip-path="url(#panel)">` +
    box({ w: W, h, fill: "#14070d" }) + stripeBand(0, "stripes") + stripeBand(h - 16, "stripes") +
    centred("WARNING", { cx: W / 2, midY: 46, scale: 5, colour: C.crimson, cls: "title" }) +
    centred(now, { cx: W / 2, midY: 78, colour: C.muted }) + rot.body + "</g>" +
    box({ x: 0.5, y: 0.5, w: W - 1, h: h - 1, rx: 6, fill: "none", stroke: C.crimsonD });
  return doc("warning.svg", { height: h, css, body, alt: `WARNING. ${now} ${lines.join(" · ")}` });
}

// ---- system status: energy bars that charge up once, then hold
const CELLS = 24, COL_CHARS = 10;
// Up to two centred lines under a bar, wrapped to the column so nothing has to shrink.
const stacked = (text, { cx, top, colour }) =>
  wrap(text, COL_CHARS).slice(0, 2).map((t, i) => centred(t, { cx, midY: top + i * LINE, colour })).join("");
function bar(b, cx) {
  const on = Math.round(b.fill * CELLS), x = cx - 17;
  const cells = Array.from({ length: CELLS }, (_, i) => {
    const y = 20 + (CELLS - 1 - i) * 6;
    if (i >= on) return box({ x: x + 6, y, w: 22, h: 4, fill: "#1a2350" });
    // Every cell is visible at rest; only the top lit one pulses. A one-shot fill-in that started
    // at opacity 0 left the bottom cells hidden in some browsers' SVG-as-image renderers.
    return box({ x: x + 6, y, w: 22, h: 4, fill: b.colour, ...(i === on - 1 ? { class: "tip" } : {}) });
  }).join("");
  return (
    box({ x: x + 1, y: 15, w: 32, h: 154, rx: 3, fill: "#05081a", stroke: C.line, "stroke-width": 2 }) + cells +
    stacked(b.value, { cx, top: 188, colour: C.fg }) + stacked(b.key, { cx, top: 188 + 2 * LINE, colour: C.muted })
  );
}

export function statusPanel(bars) {
  const h = 188 + 4 * LINE, col = W / bars.length;
  const css = "@keyframes tip{0%{opacity:1}50%{opacity:.35}}.tip{animation:tip 1.2s steps(1,end) infinite}";
  const body =
    box({ w: W, h, rx: 6, fill: C.bg, stroke: C.line }) + bars.map((b, i) => bar(b, Math.round(col * i + col / 2))).join("");
  return doc("status.svg", { height: h, css, body, alt: `System status: ${bars.map((b) => `${b.key} ${b.value}`).join(", ")}` });
}

// ---- crossover: cards where two stages already meet, and the locked ones still to come
function cardHeight(card, perLine) {
  return 46 + wrap(card.text, perLine).length * LINE + 30;
}
function card(c, { x, y, w, h, locked }) {
  const perLine = Math.floor((w - 24) / 12);
  const chip = (id, cx) => box({ x: cx, y: y + 14, w: 12, h: 12, rx: 2, fill: CHIP[id] });
  const ax = x + 12, bx = ax + 20 + textWidth(c.la) * 2 + 34;
  const head =
    chip(c.a, ax) + label(c.la, { x: ax + 20, midY: y + 20, colour: C.fg }) +
    label("×", { x: bx - 26, midY: y + 20, colour: C.saber, cls: "x" }) + chip(c.b, bx) + label(c.lb, { x: bx + 20, midY: y + 20, colour: C.fg });
  const text = wrap(c.text, perLine).map((t, i) => label(t, { x: x + 12, midY: y + 50 + i * LINE, colour: C.fg })).join("");
  const frame = locked
    ? box({ x, y, w, h, rx: 4, fill: "none", stroke: C.line, "stroke-dasharray": "6 4" })
    : box({ x, y, w, h, rx: 4, fill: C.panel2, stroke: C.line });
  return frame + head + text + label(c.out, { x: x + 12, midY: y + h - 16, colour: locked ? C.gold : C.muted });
}

function cardRows(cards, { cols, top, locked }) {
  const gap = 10, w = (W - gap * (cols - 1)) / cols, perLine = Math.floor((w - 24) / 12);
  let y = top, svg = "";
  for (let r = 0; r < cards.length; r += cols) {
    const row = cards.slice(r, r + cols), h = Math.max(...row.map((c) => cardHeight(c, perLine)));
    row.forEach((c, i) => (svg += card(c, { x: Math.round(i * (w + gap)), y, w: Math.round(w), h, locked })));
    y += h + gap;
  }
  return { svg, bottom: y - gap };
}

export function crossoverPanel({ cleared, locked }) {
  const done = cardRows(cleared, { cols: 2, top: 30, locked: false });
  const next = cardRows(locked, { cols: 3, top: done.bottom + 56, locked: true });
  const body =
    label("CROSSOVER · STAGES CLEARED", { x: 0, midY: 12, colour: C.gold }) + done.svg +
    label("NEXT STAGES · LOCKED", { x: 0, midY: done.bottom + 38, colour: C.muted }) + next.svg;
  const say = (c) => `${c.la} × ${c.lb}: ${c.text}`;
  return doc("crossover.svg", {
    height: next.bottom + 1, css: blink("x", 1.4), body,
    alt: `Crossover. Ya cruzados: ${cleared.map(say).join(" ")} Bloqueados: ${locked.map(say).join(" ")}`,
  });
}

// ---- chip log: the newest chip first, with a blinking cursor
export function chipLogPanel(rows) {
  const h = 28 + rows.length * 28;
  const body =
    box({ w: W, h, rx: 6, fill: "#05081a", stroke: C.line }) +
    rows.map((r, i) => {
      const midY = 26 + i * 28, tagX = 16 + 9 * 12;
      const cursor = i === 0 ? label("_", { x: tagX + textWidth(r.tag) * 2 + 4, midY, colour: C.saber, cls: "cursor" }) : "";
      return label(r.date, { x: 16, midY, colour: C.muted }) + label(r.tag, { x: tagX, midY, colour: C.saber }) + cursor +
        label(r.title, { x: tagX + 20 * 12, midY, colour: C.fg });
    }).join("");
  return doc("chiplog.svg", { height: h, css: blink("cursor", 1), body, alt: `Chip log: ${rows.map((r) => `${r.date} ${r.title}`).join(", ")}` });
}

// ---- inner demons: one sealed cell per private repo, eyes blinking out of phase, no names
const DEMON_CSS =
  "@keyframes eye{0%{opacity:.12}8%{opacity:1}10%{opacity:.12}12%{opacity:1}18%{opacity:.12}100%{opacity:.12}}" +
  ".eye{opacity:.6;animation:eye 5s steps(1,end) infinite}";
function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function demonCell(x, y, delay) {
  return (
    box({ x, y, w: 28, h: 28, rx: 3, fill: "url(#cell)", stroke: "#4a0c1a" }) +
    box({ x: x + 2, y: y + 2, w: 24, h: 24, rx: 2, fill: "none", stroke: "#0b0f22", "stroke-width": 2 }) +
    `<g class="eye" style="animation-delay:${fmt(delay)}s">${box({ x: x + 8, y: y + 12, w: 3, h: 3, fill: "#ff3b5c" })}${box({ x: x + 16, y: y + 12, w: 3, h: 3, fill: "#ff3b5c" })}</g>`
  );
}

export function demonsPanel({ sealed, caption }) {
  const perRow = Math.floor((W - 24 + 6) / 34), rows = Math.ceil(sealed / perRow), gridH = 24 + rows * 34 - 6;
  const rnd = seeded(5);
  const cells = Array.from({ length: sealed }, (_, i) => demonCell(12 + (i % perRow) * 34, 42 + Math.floor(i / perRow) * 34, -rnd() * 5)).join("");
  const capTop = 30 + gridH + 24, lines = wrap(caption, 72);
  const body =
    `<defs><linearGradient id="cell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0812"/><stop offset="1" stop-color="#0d050b"/></linearGradient></defs>` +
    label(`DEMONIOS INTERNOS · ${sealed} SELLADOS`, { x: 0, midY: 12, colour: C.demon }) +
    box({ y: 30, w: W, h: gridH, rx: 6, fill: "#07040d", stroke: "#3d0712" }) + cells +
    lines.map((t, i) => label(t, { x: 0, midY: capTop + i * LINE, colour: "#c9a3ad" })).join("");
  return doc("demons.svg", {
    height: capTop + (lines.length - 1) * LINE + 12, css: DEMON_CSS, body,
    alt: `Demonios internos: ${sealed} repositorios privados, sin nombre. ${caption}`,
  });
}

// ---- allies: public repos of other people this profile contributed to, and sealed alliances
export function alliesPanel({ repos, sealedAlliances }) {
  const rowY = (i) => 48 + i * 28, starX = 40 + 42 * 12, roleX = starX + 6 * 12;
  const rows = repos.map((r, i) =>
    label(">", { x: 16, midY: rowY(i), colour: C.saber, cls: "mark" }) + label(r.repo, { x: 40, midY: rowY(i), colour: C.fg }) +
    label(`*${r.stars}`, { x: starX, midY: rowY(i), colour: C.gold }) + label(r.role, { x: roleX, midY: rowY(i), colour: C.muted }));
  const sealedY = rowY(repos.length);
  const sealedRow = sealedAlliances > 0 ? label(`# ${sealedAlliances} ALIANZAS SELLADAS`, { x: 16, midY: sealedY, colour: C.demon }) : "";
  const h = sealedY + 22;
  const body = box({ w: W, h, rx: 6, fill: C.bg, stroke: C.line }) + label("ALIADOS · CO-OP", { x: 16, midY: 18, colour: C.cyan }) + rows.join("") + sealedRow;
  const sealedAlt = sealedAlliances > 0 ? ` Y ${sealedAlliances} alianzas selladas, sin nombre.` : "";
  return doc("allies.svg", {
    height: h, css: blink("mark", 1.2), body,
    alt: `Aliados: ${repos.map((r) => `${r.repo} (${r.role})`).join(", ")}.${sealedAlt}`,
  });
}

export function staticPanels(data) {
  return [
    headerPanel(data.header), ...stagePanels(data.stages), warningPanel(data.warning), statusPanel(data.status),
    crossoverPanel(data.crossover), chipLogPanel(data.chipLog), demonsPanel(data.demons), alliesPanel(data.allies),
  ];
}

// ---- face.png: the head crop of the idle hero, for the GitHub avatar (uploaded by hand)
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const AURA = [[0, hex("#4a0f22")], [0.45, hex("#1a0d26")], [0.72, hex(C.panel)]];
function aura(r) {
  if (r >= AURA[2][0]) return AURA[2][1];
  const [a, b] = r < AURA[1][0] ? [AURA[0], AURA[1]] : [AURA[1], AURA[2]];
  return lerp(a[1], b[1], (r - a[0]) / (b[0] - a[0]));
}

const CROP = { x: 24, y: 2, size: 21 };
export function faceRgb(scale = 22) {
  const head = heroPose(IDLE_POSES[0]), n = CROP.size * scale, rgb = Buffer.alloc(n * n * 3);
  for (let k = 0; k < n * n; k++) {
    const x = k % n, y = (k - x) / n;
    const c = head.px[(CROP.y + Math.floor(y / scale)) * head.w + CROP.x + Math.floor(x / scale)];
    const r = Math.hypot(x / n - 0.5, y / n - 0.62) / 0.71;
    rgb.set(c ? hex(c) : aura(r), k * 3);
  }
  return { n, rgb };
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
export function pngRgb({ n, rgb }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  const raw = Buffer.alloc(n * (n * 3 + 1));
  for (let y = 0; y < n; y++) rgb.copy(raw, y * (n * 3 + 1) + 1, y * n * 3, (y + 1) * n * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

