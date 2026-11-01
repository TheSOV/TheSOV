// CSS-only animation, the only kind a README <img> runs: GitHub serves SVG with
// `default-src 'none'; style-src 'unsafe-inline'`, so an inline <style> is all there is.
import { pathsSvg } from "./grid.mjs";

export const fmt = (n) => String(+n.toFixed(3));

// Delay that puts frame i on screen during [i*frameS, (i+1)*frameS) of each cycle. Every frame
// runs the same keyframes (visible for the first 1/n of the cycle), so frame i has to be
// started (n - i) frames into its cycle: a plain -i*frameS would play the frames backwards.
export const frameDelay = (i, n, frameS) => -(((n - i) % n) * frameS);

// Flipbook: every frame is drawn, stacked, one visible at a time; steps(1) makes each swap
// instant. With animation off (reduced motion) frame 0 is the one left on screen.
export function flipbook({ id, frames, frameS }) {
  const n = frames.length;
  const css =
    `@keyframes ${id}{0%{opacity:1}${fmt(100 / n)}%{opacity:0}100%{opacity:0}}` +
    `.${id}{opacity:0;animation:${id} ${fmt(frameS * n)}s steps(1,end) infinite}.${id}-0{opacity:1}` +
    frames.map((_, i) => `.${id}-${i}{animation-delay:${fmt(frameDelay(i, n, frameS))}s}`).join("");
  const body = frames.map((g, i) => `<g class="${id} ${id}-${i}">${pathsSvg(g)}</g>`).join("");
  return { css, body };
}

// A translation path: keys are {p: 0..100 percent of the loop, x, y}. `steps` quantises the
// motion so a sprite moves in whole jumps instead of sliding between pixels.
export function track({ id, keys, durationS, steps }) {
  const frames = keys.map(({ p, x, y }) => `${fmt(p)}%{transform:translate(${fmt(x)}px,${fmt(y)}px)}`).join("");
  return `@keyframes ${id}{${frames}}.${id}{animation:${id} ${fmt(durationS)}s steps(${steps},end) infinite}`;
}
