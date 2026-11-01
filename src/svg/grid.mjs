// Colour grid -> SVG. Each row is cut into runs of one colour, and every run of a colour goes
// into that colour's single <path> as "M x y h w v1 h-w z": a sprite costs ~12 bytes per run
// instead of ~55 for a <rect>, which is what keeps the level under the size budget.

function runsInRow({ w, px }, y) {
  const runs = [];
  let x = 0;
  while (x < w) {
    const fill = px[y * w + x];
    let len = 1;
    while (x + len < w && px[y * w + x + len] === fill) len++;
    if (fill !== null) runs.push({ x, y, w: len, fill });
    x += len;
  }
  return runs;
}

export function rowRuns(grid) {
  const runs = [];
  for (let y = 0; y < grid.h; y++) runs.push(...runsInRow(grid, y));
  return runs;
}

// One path per colour, in order of first appearance. Runs never overlap, so order is cosmetic.
export function pathsSvg(grid) {
  const byFill = new Map();
  for (const r of rowRuns(grid)) {
    const d = byFill.get(r.fill) ?? "";
    byFill.set(r.fill, `${d}M${r.x} ${r.y}h${r.w}v1h-${r.w}z`);
  }
  return [...byFill].map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join("");
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escapeXml = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

// Under reduced motion every animation stops; each animated piece sets its own resting frame.
export const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce){*{animation:none!important}}";

export const svgDocument = ({ width, height, css = "", body, label }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
  `shape-rendering="crispEdges" role="img" aria-label="${escapeXml(label)}">` +
  `<style>${css}${REDUCED_MOTION}</style>${body}</svg>`;

export const placed = ({ x = 0, y = 0, scale = 1 }, inner) =>
  `<g transform="translate(${x} ${y})${scale === 1 ? "" : ` scale(${scale})`}">${inner}</g>`;
