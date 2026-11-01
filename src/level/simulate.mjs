// The race across the year, run tick by tick exactly once, so the SVG can replay it with CSS.
// Same physics as the approved mockup: the hero runs right, jumps any column taller than where
// he stands, lands on the higher of the two columns under his feet, and cuts down every enemy
// that comes within reach. Pure: heights in, a list of ticks out.
import { ENEMIES } from "../sprites/enemies.mjs";

export const STAGE = { width: 900, height: 250, ground: 240, block: 16 };
const PHYS = { gravity: 0.26, speed: 1.5, foot0: 27, foot1: 44, start: -64, reach: 44, slash: 18 };
export const RUN_FRAMES = 8;
export const SLASH_BUCKETS = 3;

export function terrain(heights) {
  const cw = STAGE.width / heights.length;
  const colTop = (i) => STAGE.ground - heights[Math.max(0, Math.min(heights.length - 1, i))] * STAGE.block;
  return { heights, cw, colTop, topAt: (x) => colTop(Math.floor(x / cw)) };
}

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// One enemy every 4-6 columns, from the fifth to the second to last; seeded, so it never moves.
export function spawnEnemies(land) {
  const rnd = seeded(11), out = [];
  for (let i = 5; i < land.heights.length - 1; i += 4 + Math.floor(rnd() * 3)) {
    out.push({ i, x: i * land.cw + land.cw / 2, type: Math.floor(rnd() * ENEMIES.length), top: land.colTop(i) });
  }
  return out;
}

function jumpIfBlocked(s, land) {
  const ahead = land.topAt(s.x + PHYS.foot1 + 6);
  if (s.onGround && ahead < s.y - 1) {
    s.vy = -Math.sqrt(2 * PHYS.gravity * (s.y - ahead + 14));
    s.onGround = false;
  }
}

function moveAndLand(s, land) {
  if (!(land.topAt(s.x + PHYS.foot1 + 1) < s.y - 1)) s.x += PHYS.speed;
  s.vy += PHYS.gravity;
  s.y += s.vy;
  const floor = Math.min(land.topAt(s.x + PHYS.foot0), land.topAt(s.x + PHYS.foot1));
  s.onGround = s.y >= floor;
  if (s.onGround) {
    s.y = floor;
    s.vy = 0;
  }
}

const inReach = (e, s) => {
  const d = e.x - (s.x + PHYS.reach);
  return d > 0 && d < 30 && Math.abs(e.top - s.y) < 50;
};

function strike(s, enemies, tick) {
  for (const e of enemies) {
    if (e.killedAt === undefined && inReach(e, s)) {
      e.killedAt = tick;
      s.slash = PHYS.slash;
    }
  }
}

// What the hero looks like this tick: mid-cut, in the air, or one of the eight run frames.
function poseOf(s) {
  if (s.slash > 6) return `slash${Math.min(SLASH_BUCKETS - 1, Math.floor((PHYS.slash - s.slash) / 4))}`;
  if (!s.onGround) return "jump";
  return `run${Math.floor((s.x - PHYS.start) / 6) % RUN_FRAMES}`;
}

export function simulate(heights) {
  const land = terrain(heights), enemies = spawnEnemies(land);
  const s = { x: PHYS.start, y: land.colTop(0), vy: 0, onGround: true, slash: 0 };
  const ticks = [];
  while (s.x <= STAGE.width + 20) {
    jumpIfBlocked(s, land);
    moveAndLand(s, land);
    strike(s, enemies, ticks.length);
    ticks.push({ x: s.x, y: s.y, pose: poseOf(s) });
    if (s.slash > 0) s.slash--;
  }
  return { land, enemies, ticks };
}

// Where the hero stands when nothing moves (reduced motion): column 20, on the ground.
export function restingSpot(land) {
  const x = land.cw * 20;
  return { x, y: Math.min(land.topAt(x + PHYS.foot0), land.topAt(x + PHYS.foot1)) };
}

export const footSpan = { foot0: PHYS.foot0, foot1: PHYS.foot1 };
