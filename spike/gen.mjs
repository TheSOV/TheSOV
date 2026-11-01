// Spike probe generator: writes animated SVGs of increasing size and one large GIF, to measure
// what GitHub (camo + README rendering) accepts. Throwaway code: nothing in src/ imports it.
//
// Each SVG has the same shape as the real level will: N frame groups of pixel <rect>s swapped
// with steps(), plus one group translated across K keyframes. Two visible traces:
//   - a corner square that blinks: if two screenshots 1 s apart differ there, CSS animation runs
//   - a magenta "RM" bar that only shows under prefers-reduced-motion
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PAL = ["#3dffa2", "#4cc9f0", "#f2b134", "#d7263d", "#b8c2f2", "#6470ad", "#252a4c"];

// One pixel frame: a blob of W x H pixels, rows merged into runs of equal colour.
function frameRects(W, H, phase) {
  const out = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const inside = Math.hypot(x - W / 2, (y - H / 2) * 1.2) < W / 2 - 1 + Math.sin(phase + y / 3) * 2;
      if (!inside) { x++; continue; }
      const c = PAL[Math.floor(rnd() * PAL.length)];
      let w = 1;
      while (x + w < W && rnd() < 0.55) w++;
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`);
      x += w;
    }
  }
  return out.join("");
}

function probeSvg({ frames, keyframes, label }) {
  const W = 64, H = 80, FD = 0.1, LOOP = 30;
  const show = frames.map((_, i) => `.f${i}{animation:fr ${(FD * frames.length).toFixed(2)}s steps(1,end) ${(-i * FD).toFixed(2)}s infinite}`).join("");
  const pct = (100 / frames.length).toFixed(4);
  const track = Array.from({ length: keyframes }, (_, k) => {
    const t = (k / (keyframes - 1)) * 100;
    const x = Math.round((k / (keyframes - 1)) * 820);
    const y = Math.round(Math.abs(Math.sin(k / 9)) * -30);
    return `${t.toFixed(3)}%{transform:translate(${x}px,${100 + y}px)}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 200" width="900" height="200" shape-rendering="crispEdges">
<style>
@keyframes fr{0%{opacity:1}${pct}%{opacity:0}100%{opacity:0}}
@keyframes run{${track}}
@keyframes blink{0%{fill:#3dffa2}50%{fill:#d7263d}}
${show}
.runner{animation:run ${LOOP}s steps(${keyframes * 2},end) infinite}
.blink{animation:blink 1s steps(1,end) infinite}
.rm{display:none}
@media (prefers-reduced-motion: reduce){*{animation:none!important}.rm{display:inline}}
</style>
<rect width="900" height="200" fill="#0a0f24"/>
<rect class="blink" x="0" y="0" width="24" height="24"/>
<rect class="rm" x="30" y="0" width="60" height="24" fill="#ff00ff"/>
<text x="100" y="18" fill="#8f9bc8" font-family="monospace" font-size="14">${label}</text>
<g class="runner">${frames.map((f, i) => `<g class="f${i}">${f}</g>`).join("")}</g>
</svg>`;
}

// Grow frame count until the file passes the target size.
const TARGETS = [50, 150, 400, 1000];
const report = [];
for (const kb of TARGETS) {
  const frames = [];
  let svg = "";
  let keyframes = 200;
  while (true) {
    frames.push(kb <= 50 ? frameRects(36, 44, frames.length) : frameRects(64, 80, frames.length));
    keyframes = Math.min(2000, 200 + frames.length * 20);
    svg = probeSvg({ frames, keyframes, label: `probe ${kb}KB` });
    if (Buffer.byteLength(svg) >= kb * 1024) break;
  }
  const rects = (svg.match(/<rect /g) || []).length;
  writeFileSync(join(OUT, `probe-${kb}.svg`), svg);
  report.push({ file: `probe-${kb}.svg`, bytes: Buffer.byteLength(svg), frames: frames.length, rects, keyframes });
}

// ---- minimal GIF89a encoder (no dependencies): uncompressed LZW, clear code every 254 symbols.
// 9-bit codes only: a clear code every 254 symbols keeps the table from growing to 10 bits.
function lzwUncompressed(px) {
  const CLEAR = 256, EOI = 257, out = [];
  let bitBuf = 0, bitLen = 0, n = 0;
  const emit = (code) => {
    bitBuf |= code << bitLen;
    bitLen += 9;
    while (bitLen >= 8) { out.push(bitBuf & 255); bitBuf >>= 8; bitLen -= 8; }
  };
  emit(CLEAR);
  for (const p of px) {
    emit(p);
    n = (n + 1) % 254;
    if (n === 0) emit(CLEAR);
  }
  emit(EOI);
  if (bitLen > 0) out.push(bitBuf & 255);
  return out;
}

function gif({ width, height, frames, palette, delayCs }) {
  const bytes = [];
  const push = (...b) => bytes.push(...b);
  const u16 = (n) => push(n & 255, (n >> 8) & 255);
  push(...Buffer.from("GIF89a"));
  u16(width); u16(height);
  push(0xf7, 0, 0); // global colour table, 256 entries
  for (let i = 0; i < 256; i++) push(...(palette[i] || [0, 0, 0]));
  push(0x21, 0xff, 11, ...Buffer.from("NETSCAPE2.0"), 3, 1, 0, 0, 0); // loop forever
  for (const px of frames) {
    push(0x21, 0xf9, 4, 0, delayCs & 255, delayCs >> 8, 0, 0);
    push(0x2c); u16(0); u16(0); u16(width); u16(height); push(0);
    push(8); // minimum code size
    const data = lzwUncompressed(px);
    for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); push(chunk.length, ...chunk); }
    push(0);
  }
  push(0x3b);
  return Buffer.from(bytes);
}

const GW = 450, GH = 100, GF = 24;
const palette = PAL.map((h) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16)));
palette.unshift([10, 15, 36]);
const gframes = Array.from({ length: GF }, (_, f) => {
  const px = new Array(GW * GH).fill(0);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const cx = (f * 18) % GW;
    if (Math.hypot(x - cx, y - 50) < 30) px[y * GW + x] = 1 + ((x + y + f) % PAL.length);
  }
  return px;
});
const g = gif({ width: GW, height: GH, frames: gframes, palette, delayCs: 8 });
writeFileSync(join(OUT, "probe.gif"), g);
report.push({ file: "probe.gif", bytes: g.length, frames: GF });

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.table(report);
