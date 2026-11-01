import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stagePanels, stageGrid, stagePages, withStageGrid, STAGE_GRID_START, STAGE_GRID_END } from "../src/panels.mjs";
import { checkSvg } from "../src/svg/check.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const DATA = JSON.parse(read("../data/profile.json"));
const README = read("../README.md");
const STAGES = DATA.stages.filter((s) => s.id !== "me");

test("the stage select is a header and one animated tile per stage, each passing the SVG check", () => {
  const panels = stagePanels(DATA.stages);
  assert.equal(panels.length, 1 + DATA.stages.length);
  for (const p of panels) assert.deepEqual(checkSvg(p.svg).problems, [], p.name);
});

test("every stage but the player links to its own page, and the player links nowhere", () => {
  const html = stageGrid(DATA.stages, "TheSOV");
  for (const st of STAGES) assert.ok(html.includes(`<a href="https://github.com/TheSOV/TheSOV/blob/main/stages/${st.id}.md"><img src="assets/stage-${st.id}.svg"`), st.id);
  assert.ok(html.includes('<picture><img src="assets/stage-me.svg"'));
});

test("the grid is three rows of three tiles with no whitespace to push a tile onto the next line", () => {
  const grid = stageGrid(DATA.stages, "TheSOV").split("\n").at(-1);
  assert.equal(grid.split("<br>").length, 3);
  assert.doesNotMatch(grid, />\s+</);
});

test("each stage page carries its zone, boss and repos, or says it is still locked", () => {
  const pages = stagePages(DATA.stages, "TheSOV");
  assert.equal(pages.length, STAGES.length);
  for (const [i, st] of STAGES.entries()) {
    const { name, md } = pages[i];
    assert.equal(name, `stages/${st.id}.md`);
    assert.ok(md.includes(`src="../assets/stage-${st.id}.svg"`));
    for (const repo of st.repos) assert.ok(md.includes(`href="https://github.com/TheSOV/${repo}"`), `${st.id} ${repo}`);
    assert.equal(md.includes("Todavía no hay ninguno"), st.repos.length === 0, st.id);
    assert.ok(md.includes('href="https://github.com/TheSOV">◂ VOLVER AL STAGE SELECT'));
  }
});

test("the README grid and the committed stage pages are what the data generates now", () => {
  assert.equal(withStageGrid(README, DATA.stages, "TheSOV"), README);
  assert.ok(README.includes(STAGE_GRID_START) && README.includes(STAGE_GRID_END));
  for (const page of stagePages(DATA.stages, "TheSOV")) assert.equal(read(`../${page.name}`), page.md, page.name);
});

test("a README without the markers is an error, not a silently skipped grid", () => {
  assert.throws(() => withStageGrid("# nothing here", DATA.stages, "TheSOV"), /no stage-select markers/);
});
