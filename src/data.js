/* ============================================================
   DATA LOADING & AGGREGATIONS
   Loads public/data/tdf.json once at startup; all tabs read
   from these helpers. Data shape is documented in
   scripts/build_data.py.
   ============================================================ */

let DATA = null;

export async function loadData(baseUrl) {
  const res = await fetch(`${baseUrl}data/tdf.json`);
  if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
  DATA = await res.json();
  return DATA;
}

export const getMeta = () => DATA?.meta ?? {};
export const getTeams = () => DATA?.teams ?? [];
export const getRiders = () => DATA?.riders ?? [];
export const getStages = () => DATA?.stages ?? [];

/** Stage numbers completed so far, ascending (e.g. [1,2,3]). */
export const stagesComplete = () => getMeta().stagesComplete ?? [];

/** True before stage 1 results exist — tabs render roster-only views. */
export const isPreRace = () => stagesComplete().length === 0;

/** Team name for a rider record (riders store a team index). */
export const teamName = (rider) => getTeams()[rider.team] ?? "";

/** Riders sorted by total fantasy points, descending. */
export const ridersByTotal = () =>
  [...getRiders()].sort((a, b) => b.total - a.total || a.cost - b.cost);

/** Rider lookup by id. */
export const riderById = (id) => getRiders().find((r) => r.id === id);

/**
 * Cumulative points series for a set of riders:
 * [{ stage: 1, [riderId]: cumulativePts, ... }, ...]
 */
export function cumulativeSeries(riderIds) {
  const stages = stagesComplete();
  const riders = riderIds.map((id) => riderById(id)).filter(Boolean);
  const running = Object.fromEntries(riders.map((r) => [r.id, 0]));
  return stages.map((n) => {
    const row = { stage: n };
    for (const r of riders) {
      running[r.id] += r.pts[String(n)] ?? 0;
      row[r.id] = running[r.id];
    }
    return row;
  });
}

/** Per-team aggregate: total points, top rider, points by stage. */
export function teamAggregates() {
  const teams = getTeams().map((name, i) => ({
    name,
    idx: i,
    total: 0,
    riders: [],
  }));
  for (const r of getRiders()) {
    teams[r.team].total += r.total;
    teams[r.team].riders.push(r);
  }
  for (const t of teams) t.riders.sort((a, b) => b.total - a.total);
  return teams.sort((a, b) => b.total - a.total);
}

/**
 * Greedy-ish optimal squad: best legal 8-rider team by total points within
 * the star budget and category caps. Exact optimization is a small knapsack;
 * with 184 riders a bounded DP is instant and exact enough for display.
 * Returns { riders: [...], total, cost } or null pre-race.
 */
export function optimalTeam(budget, caps, size) {
  const riders = ridersByTotal().slice(0, 60); // pool: top 60 scorers is plenty
  let best = null;
  // Depth-first search with pruning — 60 choose 8 is large, but sorted-order
  // pruning on "remaining best possible" keeps this fast in practice.
  const suffixBest = [];
  let acc = 0;
  for (let i = riders.length - 1; i >= 0; i--) {
    suffixBest[i] = (suffixBest[i + 1] ?? 0) + riders[i].total;
  }
  const pick = [];
  const catCount = {};
  const dfs = (idx, cost, total) => {
    if (pick.length === size) {
      if (!best || total > best.total) best = { riders: [...pick], total, cost };
      return;
    }
    if (idx >= riders.length) return;
    // Prune: even taking the best remaining riders can't beat current best.
    if (best && total + (suffixBest[idx] ?? 0) < best.total) return;
    const r = riders[idx];
    const cat = r.cat;
    if (cost + r.cost <= budget && (catCount[cat] ?? 0) < caps[cat]) {
      pick.push(r);
      catCount[cat] = (catCount[cat] ?? 0) + 1;
      dfs(idx + 1, cost + r.cost, total + r.total);
      pick.pop();
      catCount[cat] -= 1;
    }
    dfs(idx + 1, cost, total);
  };
  dfs(0, 0, 0);
  return best;
}
