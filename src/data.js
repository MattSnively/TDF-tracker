/* ============================================================
   DATA LOADING & AGGREGATIONS
   Loads public/data/tdf.json once at startup. Fantasy points are
   the official Tissot game scores (see scripts/build_data.py).
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
export const getMyTeam = () => DATA?.myTeam ?? { stages: {}, standings: [] };

export const stagesComplete = () => getMeta().stagesComplete ?? [];
export const isPreRace = () => stagesComplete().length === 0;
export const teamName = (rider) => getTeams()[rider.team] ?? "";

/** Riders sorted by official total points, descending. */
export const ridersByTotal = () =>
  [...getRiders()].sort((a, b) => b.total - a.total || (a.cost ?? 99) - (b.cost ?? 99));

export const riderById = (id) => getRiders().find((r) => r.id === id);

/** Per-team aggregate of official points, with each team's riders. */
export function teamAggregates() {
  const teams = getTeams().map((name, i) => ({ name, idx: i, total: 0, riders: [] }));
  for (const r of getRiders()) {
    teams[r.team].total += r.total;
    teams[r.team].riders.push(r);
  }
  for (const t of teams) t.riders.sort((a, b) => b.total - a.total);
  return teams.sort((a, b) => b.total - a.total);
}

/**
 * Best legal 8-rider squad by official total within the star budget and
 * category caps (exact small-knapsack via pruned DFS). Riders without a known
 * cost are excluded. Returns { riders, total, cost } or null.
 */
export function optimalTeam(budget, caps, size) {
  const pool = ridersByTotal()
    .filter((r) => r.cost != null && r.total > 0)
    .slice(0, 60);
  let best = null;
  const suffixBest = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    suffixBest[i] = (suffixBest[i + 1] ?? 0) + pool[i].total;
  }
  const pick = [];
  const catCount = {};
  const dfs = (idx, cost, total) => {
    if (pick.length === size) {
      if (!best || total > best.total) best = { riders: [...pick], total, cost };
      return;
    }
    if (idx >= pool.length) return;
    if (best && total + (suffixBest[idx] ?? 0) < best.total) return;
    const r = pool[idx];
    if (cost + r.cost <= budget && (catCount[r.cat] ?? 0) < (caps[r.cat] ?? size)) {
      pick.push(r);
      catCount[r.cat] = (catCount[r.cat] ?? 0) + 1;
      dfs(idx + 1, cost + r.cost, total + r.total);
      pick.pop();
      catCount[r.cat] -= 1;
    }
    dfs(idx + 1, cost, total);
  };
  dfs(0, 0, 0);
  return best;
}
