/* My Team tab: any viewer builds their own 8-rider squad under the game's
   budget and category caps, picks a captain (Shimano Bonus — stage points
   doubled), and tracks daily + cumulative scores. Persisted per-browser in
   localStorage; nothing is tied to a login. */

import { useEffect, useMemo, useState } from "react";

import { Card, CatChip, SectionTitle, StatTile } from "../components/Primitives.jsx";
import { getRiders, isPreRace, riderById, stagesComplete, teamName } from "../data.js";
import {
  ACCENT,
  ACCENT_SOFT,
  CATEGORIES,
  CATEGORY_CAPS,
  GRAY_200,
  GRAY_500,
  INK,
  INK_SURFACE,
  STAR_BUDGET,
  TEAM_SIZE,
  fmtN,
  stageDate,
} from "../tokens.js";

const STORAGE_KEY = "tdf2026-myteam-v1";

/** Load {ids: [...], captain: id|null} from localStorage. */
function loadTeam() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Drop ids that no longer exist in the data (e.g. roster fix renamed one).
      const ids = (parsed.ids ?? []).filter((id) => riderById(id));
      return { ids, captain: ids.includes(parsed.captain) ? parsed.captain : null };
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return { ids: [], captain: null };
}

export function MyTeamTab() {
  const [team, setTeam] = useState(loadTeam);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  // Persist on every change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
  }, [team]);

  const picked = team.ids.map((id) => riderById(id)).filter(Boolean);
  const spent = picked.reduce((s, r) => s + r.cost, 0);
  const catCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const r of picked) catCounts[r.cat] += 1;

  const stages = stagesComplete();

  // Squad scoring: captain's stage-points component doubles (jersey bonuses
  // never double, per the game rules).
  const scores = useMemo(() => {
    const perStage = stages.map((n) => {
      const k = String(n);
      let pts = 0;
      for (const r of picked) {
        const [stagePts, bonusPts] = r.split[k] ?? [0, 0];
        const captainMult = r.id === team.captain ? 2 : 1;
        pts += stagePts * captainMult + bonusPts;
      }
      return { n, pts };
    });
    const total = perStage.reduce((s, x) => s + x.pts, 0);
    return { perStage, total };
  }, [picked, team.captain, stages]);

  const toggle = (rider) => {
    setTeam((t) => {
      if (t.ids.includes(rider.id)) {
        const ids = t.ids.filter((id) => id !== rider.id);
        return { ids, captain: t.captain === rider.id ? null : t.captain };
      }
      // Enforce game constraints on add.
      if (t.ids.length >= TEAM_SIZE) return t;
      if (spent + rider.cost > STAR_BUDGET) return t;
      if (catCounts[rider.cat] >= CATEGORY_CAPS[rider.cat]) return t;
      return { ...t, ids: [...t.ids, rider.id] };
    });
  };

  const canAdd = (rider) =>
    team.ids.includes(rider.id) ||
    (team.ids.length < TEAM_SIZE &&
      spent + rider.cost <= STAR_BUDGET &&
      catCounts[rider.cat] < CATEGORY_CAPS[rider.cat]);

  const pool = useMemo(() => {
    let list = getRiders();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (catFilter) list = list.filter((r) => r.cat === catFilter);
    return [...list].sort((a, b) => b.total - a.total || b.cost - a.cost);
  }, [search, catFilter]);

  return (
    <div className="pt-4">
      {/* Budget / status row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Riders picked" value={`${picked.length} / ${TEAM_SIZE}`} />
        <StatTile
          label="Stars spent"
          value={`${spent} / ${STAR_BUDGET}★`}
          sub={spent > STAR_BUDGET ? "Over budget!" : `${STAR_BUDGET - spent}★ left`}
        />
        <StatTile
          label="Total score"
          value={isPreRace() ? "—" : fmtN(scores.total)}
          sub={isPreRace() ? "race starts soon" : `${stages.length} stages scored`}
        />
        <StatTile
          label="Captain"
          value={team.captain ? riderById(team.captain)?.name : "—"}
          sub="stage points ×2"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-2">
        {/* Current squad */}
        <div>
          <SectionTitle>
            Your squad
            <span className="text-[11px] font-normal ml-2" style={{ color: GRAY_500 }}>
              max {CATEGORY_CAPS.Leaders} LDR · {CATEGORY_CAPS.Sprinters} SPR ·{" "}
              {CATEGORY_CAPS.Climbers} CLM · {CATEGORY_CAPS["All-rounders"]} ALL
            </span>
          </SectionTitle>
          <Card className="p-0 overflow-x-auto">
            {picked.length === 0 ? (
              <div className="p-4 text-[12px]" style={{ color: GRAY_500 }}>
                Pick up to {TEAM_SIZE} riders from the pool. Your team is saved in
                this browser — no account needed.
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <tbody>
                  {picked.map((r) => (
                    <tr key={r.id} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => setTeam((t) => ({ ...t, captain: t.captain === r.id ? null : r.id }))}
                          className="text-[14px]"
                          title="Set as captain (Shimano Bonus — stage points ×2)"
                          aria-label={`Set ${r.name} as captain`}
                          style={{ opacity: team.captain === r.id ? 1 : 0.25 }}
                        >
                          ⭐
                        </button>
                      </td>
                      <td className="px-1 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                      <td className="px-1 py-1.5"><CatChip cat={r.cat} /></td>
                      <td className="px-2 py-1.5 hidden sm:table-cell" style={{ color: GRAY_500 }}>{teamName(r)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtN(r.total)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          onClick={() => toggle(r)}
                          className="text-[11px] px-2 py-0.5 rounded"
                          style={{ background: "var(--gray-100)", color: "var(--red)" }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Daily score table */}
          {!isPreRace() && picked.length > 0 && (
            <>
              <SectionTitle>Daily scores</SectionTitle>
              <Card className="p-0 overflow-x-auto">
                <table className="w-full text-[12px]">
                  <tbody>
                    {scores.perStage.map(({ n, pts }) => (
                      <tr key={n} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                        <td className="px-4 py-1.5">Stage {n} · {stageDate(n)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(pts)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold" style={{ borderColor: GRAY_200, color: INK, background: ACCENT_SOFT }}>
                      <td className="px-4 py-1.5">Total</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{fmtN(scores.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>

        {/* Rider pool */}
        <div>
          <SectionTitle>Rider pool</SectionTitle>
          <div className="flex gap-2 mb-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rider…"
              className="px-3 py-1.5 text-[12px] rounded border outline-none flex-1"
              style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}
            />
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-2 py-1.5 text-[12px] rounded border"
              style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Card className="p-0 overflow-x-auto" style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="w-full text-[12px]">
              <tbody>
                {pool.map((r) => {
                  const inTeam = team.ids.includes(r.id);
                  const disabled = !canAdd(r);
                  return (
                    <tr
                      key={r.id}
                      className="border-t first:border-t-0"
                      style={{
                        borderColor: "var(--gray-100)",
                        color: INK,
                        opacity: disabled && !inTeam ? 0.45 : 1,
                        background: inTeam ? ACCENT_SOFT : undefined,
                      }}
                    >
                      <td className="px-3 py-1 font-medium whitespace-nowrap">{r.name}</td>
                      <td className="px-1 py-1"><CatChip cat={r.cat} /></td>
                      <td className="px-2 py-1 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtN(r.total)}</td>
                      <td className="px-3 py-1 text-right">
                        <button
                          onClick={() => toggle(r)}
                          disabled={disabled && !inTeam}
                          className="text-[11px] px-2 py-0.5 rounded font-medium"
                          style={
                            inTeam
                              ? { background: "var(--gray-100)", color: "var(--red)" }
                              : { background: INK_SURFACE, color: "white" }
                          }
                        >
                          {inTeam ? "Remove" : "Add"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
