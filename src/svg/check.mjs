// Gate for every SVG the profile publishes. A valid, small SVG can still be broken, so it
// checks the three ways ours go wrong: too heavy for GitHub, carrying something the README
// sanitizer or CSP would strip (or that should never be in an image), and not animating.
//
//   node src/svg/check.mjs <file-or-dir>...   prints one summary line, exits 1 on any problem
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The spike rendered and animated a 1 070 982-byte SVG on GitHub in Chrome, Firefox, Safari and
// the mobile app; the budget stays under what was measured, not at a limit nobody found.
export const BUDGET_BYTES = 1_000_000;

export const FORBIDDEN = [
  ["<script", /<script\b/i],
  ["event handler", /<[^>]*\son[a-z]+\s*=/i],
  ["external href", /\bhref\s*=\s*["'](?!#)/i],
  ["@import", /@import\b/i],
  ["remote url()", /url\(\s*["']?(?!#)/i],
  ["<foreignObject", /<foreignObject\b/i],
];

const forbiddenIn = (text) => FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => name);
const animates = (text) => /@keyframes\b/.test(text) && /steps\(/.test(text);

// Every SVG here is meant to move, so one without keyframes and steps() is a broken build.
export function checkSvg(text, budget = BUDGET_BYTES) {
  const bytes = Buffer.byteLength(text);
  const problems = [];
  if (bytes > budget) problems.push({ kind: "over budget", detail: `${bytes} > ${budget} bytes` });
  for (const name of forbiddenIn(text)) problems.push({ kind: "forbidden", detail: name });
  if (!animates(text)) problems.push({ kind: "without keyframes", detail: "needs @keyframes and steps(" });
  return { bytes, problems };
}

function svgFiles(target) {
  if (!existsSync(target)) return [{ file: target, missing: true }];
  if (!statSync(target).isDirectory()) return [{ file: target }];
  return readdirSync(target).filter((f) => f.endsWith(".svg")).sort().map((f) => ({ file: join(target, f) }));
}

const KINDS = ["over budget", "forbidden", "without keyframes", "missing"];

export function checkPaths(targets) {
  const results = targets.flatMap(svgFiles).map(({ file, missing }) =>
    missing ? { file, problems: [{ kind: "missing", detail: "no such file" }] } : { file, ...checkSvg(readFileSync(file, "utf8")) });
  const count = (kind) => results.filter((r) => r.problems.some((p) => p.kind === kind)).length;
  const ok = results.filter((r) => r.problems.length === 0).length;
  const summary = `${ok} svg ok, ${KINDS.map((k) => `${count(k)} ${k}`).join(", ")}`;
  return { results, summary, failed: ok !== results.length };
}

function main(argv) {
  const { results, summary, failed } = checkPaths(argv);
  for (const r of results) for (const p of r.problems) console.error(`${r.file}: ${p.kind}: ${p.detail}`);
  console.log(summary);
  process.exitCode = failed || results.length === 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
