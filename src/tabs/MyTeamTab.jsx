/* My Team tab: Matt's ACTUAL official squad, per-stage scores, rank, and league
   standings pulled from the Tissot game — plus a "build your own" section that
   scores any 8-rider squad by official cumulative points. */

import { useEffect, useMemo, useState } from "react";

import { Card, CatChip, SectionTitle, StatTile } from "../components/Primitives.jsx";
import { getMyTeam, getRiders, isPreRace, riderById, teamName } from "../data.js";
import {
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
} from "../tokens.js";

const STORAGE_KEY = "tdf2026-myteam-v2";

/* ── Matt's official team ── */
function OfficialTeam() {
  const my = getMyTeam();
  const stageNums = Object.keys(my.stages).map(Number).sort((a, b) => a - b);
  const latest = stageNums[stageNums.length - 1];
  const sheet = my.stages[String(latest)];
  const myRow = my.standings.find((s) => s.me);
  if (!sheet) return null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="My rank" value={myRow ? `#${myRow.position}` : "—"} sub="in my league" />
        <StatTile label="My total" value={myRow ? fmtN(myRow.total) : "—"} sub="cumulative points" />
        <StatTile label={`Stage ${latest} score`} value={fmtN(sheet.total)}
          sub={sheet.bonusQuestion ? `incl. ${sheet.bonusQuestion} bonus-question pts` : ""} />
        <StatTile label="Stages played" value={stageNums.length} sub={`of 21`} />
      </div>

      <SectionTitle>My squad — stage {latest} points</SectionTitle>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-[12px]"><tbody>
          {sheet.riders.map((r, i) => (
            <tr key={i} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
              <td className="px-3 py-1.5 w-8">{r.captain && <span title="Shimano Bonus (captain, ×2 stage points)">⭐</span>}</td>
              <td className="px-1 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(r.points)}</td>
            </tr>
          ))}
        </tbody></table>
      </Card>

      <div className="grid md:grid-cols-2 gap-3 mt-2">
        <div>
          <SectionTitle>My score by stage</SectionTitle>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-[12px]"><tbody>
              {stageNums.map((n) => (
                <tr key={n} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                  <td className="px-4 py-1.5">Stage {n}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(my.stages[String(n)].total)}</td>
                </tr>
              ))}
            </tbody></table>
          </Card>
        </div>
        <div>
          <SectionTitle>My league</SectionTitle>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-[12px]"><tbody>
              {my.standings.map((s) => (
                <tr key={s.position} className="border-t first:border-t-0"
                  style={{ borderColor: GRAY_200, color: INK, background: s.me ? ACCENT_SOFT : undefined }}>
                  <td className="px-4 py-1.5 w-8" style={{ color: GRAY_500 }}>{s.position}</td>
                  <td className="px-2 py-1.5 font-medium">{s.manager}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(s.total)}</td>
                </tr>
              ))}
            </tbody></table>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ── Build-your-own squad (scored by official cumulative points) ── */
function loadTeam() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw).ids ?? []).filter((id) => riderById(id));
  } catch {
    /* ignore */
  }
  return [];
}

function Builder() {
  const [ids, setIds] = useState(loadTeam);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids })), [ids]);

  const picked = ids.map((id) => riderById(id)).filter(Boolean);
  const spent = picked.reduce((s, r) => s + (r.cost ?? 0), 0);
  const total = picked.reduce((s, r) => s + r.total, 0);
  const catCounts = Object.fromEntries(CATEGORIES.map((c) => [c, picked.filter((r) => r.cat === c).length]));

  const canAdd = (r) =>
    ids.includes(r.id) ||
    (r.cost != null &&
      ids.length < TEAM_SIZE &&
      spent + r.cost <= STAR_BUDGET &&
      catCounts[r.cat] < CATEGORY_CAPS[r.cat]);

  const toggle = (r) =>
    setIds((cur) => (cur.includes(r.id) ? cur.filter((x) => x !== r.id) : canAdd(r) ? [...cur, r.id] : cur));

  const pool = useMemo(() => {
    let list = getRiders().filter((r) => r.cost != null);
    if (search) list = list.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
    if (catFilter) list = list.filter((r) => r.cat === catFilter);
    return [...list].sort((a, b) => b.total - a.total);
  }, [search, catFilter]);

  return (
    <>
      <SectionTitle right={<span className="text-[11px]" style={{ color: GRAY_500 }}>scored by official cumulative points</span>}>
        Build your own squad
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Picked" value={`${picked.length} / ${TEAM_SIZE}`} />
        <StatTile label="Stars" value={`${spent} / ${STAR_BUDGET}★`} sub={spent > STAR_BUDGET ? "over budget" : `${STAR_BUDGET - spent}★ left`} />
        <StatTile label="Would have scored" value={fmtN(total)} sub="official pts to date" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-2">
        <div>
          <SectionTitle>Your picks</SectionTitle>
          <Card className="p-0 overflow-x-auto">
            {picked.length === 0 ? (
              <div className="p-4 text-[12px]" style={{ color: GRAY_500 }}>
                Pick up to {TEAM_SIZE} riders (max {CATEGORY_CAPS.Leaders} leaders / {CATEGORY_CAPS.Sprinters} sprinters /
                {" "}{CATEGORY_CAPS.Climbers} climbers / {CATEGORY_CAPS["All-rounders"]} all-rounders, {STAR_BUDGET}★ budget).
                Saved in this browser.
              </div>
            ) : (
              <table className="w-full text-[12px]"><tbody>
                {picked.map((r) => (
                  <tr key={r.id} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-1 py-1.5"><CatChip cat={r.cat} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtN(r.total)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => toggle(r)} className="text-[11px] px-2 py-0.5 rounded" style={{ background: "var(--gray-100)", color: "var(--red)" }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </Card>
        </div>
        <div>
          <SectionTitle>Rider pool</SectionTitle>
          <div className="flex gap-2 mb-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rider…"
              className="px-3 py-1.5 text-[12px] rounded border outline-none flex-1"
              style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }} />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              className="px-2 py-1.5 text-[12px] rounded border" style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Card className="p-0 overflow-x-auto" style={{ maxHeight: 480, overflowY: "auto" }}>
            <table className="w-full text-[12px]"><tbody>
              {pool.map((r) => {
                const inTeam = ids.includes(r.id);
                const disabled = !canAdd(r);
                return (
                  <tr key={r.id} className="border-t first:border-t-0"
                    style={{ borderColor: "var(--gray-100)", color: INK, opacity: disabled && !inTeam ? 0.45 : 1, background: inTeam ? ACCENT_SOFT : undefined }}>
                    <td className="px-3 py-1 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-1 py-1"><CatChip cat={r.cat} /></td>
                    <td className="px-2 py-1 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtN(r.total)}</td>
                    <td className="px-3 py-1 text-right">
                      <button onClick={() => toggle(r)} disabled={disabled && !inTeam}
                        className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={inTeam ? { background: "var(--gray-100)", color: "var(--red)" } : { background: INK_SURFACE, color: "white" }}>
                        {inTeam ? "Remove" : "Add"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody></table>
          </Card>
        </div>
      </div>
    </>
  );
}

export function MyTeamTab() {
  const my = getMyTeam();
  const hasOfficial = Object.keys(my.stages ?? {}).length > 0;
  if (isPreRace()) {
    return <div className="pt-4"><Card className="text-center py-8"><div className="text-[13px]" style={{ color: INK }}>Your team and rank appear once the Tour is underway.</div></Card></div>;
  }
  return (
    <div className="pt-4">
      {hasOfficial && <OfficialTeam />}
      <div className="mt-6 pt-4 border-t" style={{ borderColor: GRAY_200 }}>
        <Builder />
      </div>
    </div>
  );
}
