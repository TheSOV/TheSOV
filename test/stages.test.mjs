import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stagePanels, stageTable, withStageTable, STAGE_TABLE_START, STAGE_TABLE_END } from "../src/panels.mjs";
import { checkSvg } from "../src/svg/check.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const DATA = JSON.parse(read("../data/profile.json"));
const README = read("../README.md");

test("the stage select is a header and one animated tile per stage, each passing the SVG check", () => {
  const panels = stagePanels(DATA.stages);
  assert.equal(panels.length, 1 + DATA.stages.length);
  for (const p of panels) assert.deepEqual(checkSvg(p.svg).problems, [], p.name);
});

test("every stage but the player opens a sheet with its zone, boss and repos", () => {
  const html = stageTable(DATA.stages, "TheSOV");
  assert.equal(html.match(/<details>/g).length, DATA.stages.length - 1);
  for (const st of DATA.stages.filter((s) => s.id !== "me")) {
    for (const repo of st.repos) assert.ok(html.includes(`href="https://github.com/TheSOV/${repo}"`), repo);
  }
  assert.equal(html.match(/Todavía no hay ninguno/g).length, DATA.stages.filter((s) => s.repos?.length === 0).length);
});

test("no tile image is a bare <img>, which GitHub would wrap in a link that takes the click", () => {
  const html = stageTable(DATA.stages, "TheSOV");
  const tiles = html.match(/<img src="assets\/stage-(?!head)[^"]+"/g);
  assert.equal(tiles.length, DATA.stages.length);
  assert.equal(html.match(/<picture><img src="assets\/stage-/g).length, DATA.stages.length);
});

test("the README's stage-select block is what the data generates now", () => {
  assert.equal(withStageTable(README, DATA.stages, "TheSOV"), README);
  assert.ok(README.includes(STAGE_TABLE_START) && README.includes(STAGE_TABLE_END));
});

test("a README without the markers is an error, not a silently skipped table", () => {
  assert.throws(() => withStageTable("# nothing here", DATA.stages, "TheSOV"), /no stage-select markers/);
});
