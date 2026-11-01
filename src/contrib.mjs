// Contributions in, terrain heights out. The calendar comes from GitHub's GraphQL API with the
// token every Action run is given; locally it comes from data/contrib.sample.json, which has the
// same shape as the API's answer. Anything that is not that shape is an error, so the daily build
// fails and publishes nothing; a year of zeros is not an error, it is a flat level.

export const WEEKS = 52;
export const MAX_HEIGHT = 6;

export const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
  totalContributions weeks{contributionDays{contributionCount}}}}}}`;

const isCount = (n) => Number.isInteger(n) && n >= 0;
const isWeek = (w) => Array.isArray(w?.contributionDays) && w.contributionDays.every((d) => isCount(d?.contributionCount));

const hasWeeks = (weeks) => Array.isArray(weeks) && weeks.length >= WEEKS && weeks.every(isWeek);
const errorsOf = (json) => (Array.isArray(json?.errors) ? json.errors : []);
const CALENDAR_PATH = ["data", "user", "contributionsCollection", "contributionCalendar"];
const dig = (value, path) => path.reduce((o, key) => (o == null ? undefined : o[key]), value);

function calendarOf(json) {
  const errors = errorsOf(json);
  if (errors.length > 0) throw new Error(`GraphQL errors: ${errors.map((e) => e?.message).join("; ")}`);
  const calendar = dig(json, CALENDAR_PATH);
  if (!calendar) throw new Error("no contributionCalendar in the answer");
  return calendar;
}

// The API answer -> { total, weeks: the last 52 weekly sums, oldest first }.
export function parseCalendar(json) {
  const { totalContributions: total, weeks } = calendarOf(json);
  if (!isCount(total)) throw new Error("totalContributions is not a count");
  if (!hasWeeks(weeks)) {
    throw new Error(`expected at least ${WEEKS} weeks of contributionDays`);
  }
  const sums = weeks.slice(-WEEKS).map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
  return { total, weeks: sums };
}

// Weekly sums -> column heights 0..6, relative to the busiest week; any activity is at least 1.
export function weekHeights(weeks) {
  const max = Math.max(0, ...weeks);
  return weeks.map((n) => (max === 0 ? 0 : Math.ceil((MAX_HEIGHT * n) / max)));
}

async function postOnce(login, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "thesov-profile-level" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  return parseCalendar(await res.json());
}

// One retry before giving up: a transient 502 should not cost a day of the level.
export async function fetchCalendar(login, token) {
  try {
    return await postOnce(login, token);
  } catch (first) {
    console.error(`retrying after: ${first.message}`);
    return postOnce(login, token);
  }
}
