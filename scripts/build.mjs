// Writes the fixed panels of the profile to assets/: one SVG per panel from data/profile.json,
// and face.png for the avatar (uploaded by hand), then regenerates the stage-select table between
// its markers in README.md. The daily level is a separate build.
//
//   node scripts/build.mjs        prints one line per file written, with its size
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { staticPanels, faceRgb, pngRgb, withStageTable } from "../src/panels.mjs";

const LOGIN = "TheSOV";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "assets");

function write(name, content) {
  const file = join(ASSETS, name);
  writeFileSync(file, content);
  console.log(`${name.padEnd(14)} ${String(Buffer.byteLength(content)).padStart(8)} bytes`);
}

function main() {
  const data = JSON.parse(readFileSync(join(ROOT, "data", "profile.json"), "utf8"));
  mkdirSync(ASSETS, { recursive: true });
  for (const panel of staticPanels(data)) write(panel.name, panel.svg);
  write("face.png", pngRgb(faceRgb()));
  const readmeFile = join(ROOT, "README.md");
  writeFileSync(readmeFile, withStageTable(readFileSync(readmeFile, "utf8"), data.stages, LOGIN));
  console.log("README.md      stage-select table");
}

main();
