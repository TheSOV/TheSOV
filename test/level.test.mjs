import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCalendar, weekHeights, WEEKS, MAX_HEIGHT } from "../src/contrib.mjs";
import { simulate, STAGE, footSpan } from "../src/level/simulate.mjs";
import { levelSvg, spansOf } from "../src/level/render.mjs";
import { checkSvg } from "../src/svg/check.mjs";

const SAMPLE = JSON.parse(readFileSync(new URL("../data/contrib.sample.json", import.meta.url), "utf8"));
const answer = (weeks, total = 0) => ({ data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: total, weeks } } } } });
const week = (n) => ({ contributionDays: [n, 0, 0, 0, 0, 0, 0].map((c) => ({ contributionCount: c })) });

test("the sample calendar parses to the last 52 weekly sums and its total", () => {
  const { total, weeks } = parseCalendar(SAMPLE);
  assert.equal(weeks.length, WEEKS);
  assert.ok(total > 0);
  assert.ok(weeks.every((n) => Number.isInteger(n) && n >= 0));
});

test("heights run 0..6 relative to the busiest week, and any activity is at least one block", () => {
  assert.deepEqual(weekHeights([0, 1, 50, 100]), [0, 1, 3, MAX_HEIGHT]);
  assert.deepEqual(weekHeights([0, 0, 0]), [0, 0, 0]);
});

for (const [name, json, why] of [
  ["GraphQL errors on HTTP 200", { errors: [{ message: "rate limited" }], data: null }, /GraphQL errors: rate limited/],
  ["no calendar", { data: { user: null } }, /no contributionCalendar/],
  ["too few weeks", answer(Array.from({ length: 10 }, () => week(1))), /at least 52 weeks/],
  ["a negative count", answer(Array.from({ length: 53 }, (_, i) => week(i === 3 ? -1 : 1))), /at least 52 weeks/],
  ["a total that is not a count", answer(Array.from({ length: 53 }, () => week(1)), "12"), /not a count/],
]) {
  test(`malformed data is an error, not a level: ${name}`, () => assert.throws(() => parseCalendar(json), why));
}

test("a year of zeros is a flat level, not an error", () => {
  const { svg, sim } = levelSvg(parseCalendar(answer(Array.from({ length: 53 }, () => week(0)))));
  assert.ok(sim.land.heights.every((h) => h === 0));
  assert.ok(sim.ticks.every((t) => t.y === STAGE.ground));
  assert.deepEqual(checkSvg(svg).problems, []);
});

test("the sample level has 52 columns and passes the SVG check", () => {
  const { svg, sim } = levelSvg(parseCalendar(SAMPLE), { sample: true });
  assert.equal(sim.land.heights.length, WEEKS);
  assert.deepEqual(checkSvg(svg).problems, []);
  assert.match(svg, /aria-label="[^"]*datos de ejemplo/);
});

test("the hero is never below the terrain under either foot, on any tick", () => {
  const { land, ticks } = simulate(weekHeights(parseCalendar(SAMPLE).weeks));
  for (const [i, t] of ticks.entries()) {
    const floor = Math.min(land.topAt(t.x + footSpan.foot0), land.topAt(t.x + footSpan.foot1));
    assert.ok(t.y <= floor, `tick ${i}: y ${t.y} is below the floor ${floor}`);
  }
});

test("the race reaches the right edge and every enemy is cut down at most once", () => {
  const { ticks, enemies } = simulate(weekHeights(parseCalendar(SAMPLE).weeks));
  assert.ok(ticks.at(-1).x > STAGE.width);
  const killed = enemies.filter((e) => e.killedAt !== undefined).map((e) => e.killedAt);
  assert.ok(killed.length > 0);
  assert.equal(new Set(killed.map((k, i) => `${i}:${k}`)).size, killed.length);
});

test("spans merge consecutive ticks and keep gaps apart", () => {
  const ticks = ["a", "a", "b", "a", "a", "a"].map((pose) => ({ pose }));
  assert.deepEqual(spansOf(ticks, (t) => t.pose === "a"), [[0, 2], [3, 6]]);
  assert.deepEqual(spansOf(ticks, (t) => t.pose === "z"), []);
});
