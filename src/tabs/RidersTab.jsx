/* Riders tab: the full sortable/filterable rider table with per-stage
   sparklines, plus a click-through detail panel per rider. */

import { useMemo, useState } from "react";

import { Card, CatChip, SectionTitle } from "../components/Primitives.jsx";
import { getRiders, getTeams, isPreRace, stagesComplete, teamName } from "../data.js";
import {
  CAT_COLORS,
  CATEGORIES,
  GRAY_200,
  GRAY_500,
  INK,
  INK_SURFACE,
  fmtN,
  stageDate,
} from "../tokens.js";

/** Tiny inline SVG sparkline of a rider's per-stage points. */
function Sparkline({ rider, stages }) {
  if (stages.length < 2) return null;
  const vals = stages.map((n) => rider.pts[String(n)] ?? 0);
  const max = Math.max(...vals, 1);
  const w = 80;
  const h = 20;
  const step = w / (vals.length - 1);
  const points = vals
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline points={points} fill="none" stroke={CAT_COLORS[rider.cat]} strokeWidth="1.5" />
    </svg>
  );
}

/** Expanded detail row: stage-by-stage breakdown for one rider. */
function RiderDetail({ rider, stages }) {
  const componentsLabel = {
    finish: "Finish",
    sprint: "Sprint",
    col: "Cols",
    combativity: "Combativity",
    gc: "GC bonus",
    points: "Points-jersey bonus",
    kom: "KOM-jersey bonus",
    youth: "Youth bonus",
    super_combativity: "Super-combativity",
  };
  return (
    <tr>
      <td colSpan={7} className="px-4 py-3" style={{ background: "var(--gray-50)" }}>
        <div className="text-[11px] font-medium mb-2" style={{ color: GRAY_500 }}>
          Stage-by-stage breakdown
        </div>
        <div className="overflow-x-auto">
          <table className="text-[11px]" style={{ color: INK }}>
            <thead>
              <tr style={{ color: GRAY_500 }}>
                <th className="pr-4 py-1 text-left font-medium">Stage</th>
                <th className="pr-4 py-1 text-right font-medium">Finish pos</th>
                <th className="pr-4 py-1 text-right font-medium">GC pos</th>
                <th className="pr-4 py-1 text-right font-medium">Points</th>
                <th className="py-1 text-left font-medium">Components</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((n) => {
                const k = String(n);
                const detail = rider.detail[k] ?? {};
                const [finishRank, gcRank] = rider.ranks[k] ?? [null, null];
                return (
                  <tr key={n} className="border-t" style={{ borderColor: GRAY_200 }}>
                    <td className="pr-4 py-1">S{n} · {stageDate(n)}</td>
                    <td className="pr-4 py-1 text-right tabular-nums">{finishRank ?? "—"}</td>
                    <td className="pr-4 py-1 text-right tabular-nums">{gcRank ?? "—"}</td>
                    <td className="pr-4 py-1 text-right tabular-nums font-semibold">
                      {fmtN(rider.pts[k] ?? 0)}
                    </td>
                    <td className="py-1" style={{ color: GRAY_500 }}>
                      {Object.entries(detail)
                        .map(([c, v]) => `${componentsLabel[c] ?? c} ${v}`)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export function RidersTab() {
  const stages = stagesComplete();
  const teams = getTeams();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [team, setTeam] = useState("");
  const [sortKey, setSortKey] = useState(isPreRace() ? "cost" : "total");
  const [sortDir, setSortDir] = useState(-1);
  const [expanded, setExpanded] = useState(null);

  const rows = useMemo(() => {
    let list = getRiders();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (cat) list = list.filter((r) => r.cat === cat);
    if (team !== "") list = list.filter((r) => r.team === Number(team));
    const val = (r) =>
      sortKey === "value" ? r.total / r.cost : sortKey === "team" ? teamName(r) : r[sortKey];
    return [...list].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
    });
  }, [search, cat, team, sortKey, sortDir]);

  const sortBtn = (key, label, align = "right") => (
    <th
      className={`px-2 py-2 font-medium cursor-pointer select-none text-${align}`}
      onClick={() => {
        if (sortKey === key) setSortDir(-sortDir);
        else {
          setSortKey(key);
          setSortDir(-1);
        }
      }}
    >
      {label}
      {sortKey === key ? (sortDir < 0 ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="pt-4">
      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rider…"
          className="px-3 py-1.5 text-[12px] rounded border outline-none"
          style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="px-2 py-1.5 text-[12px] rounded border"
          style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="px-2 py-1.5 text-[12px] rounded border"
          style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}
        >
          <option value="">All teams</option>
          {teams.map((t, i) => (
            <option key={t} value={i}>{t}</option>
          ))}
        </select>
        <span className="text-[11px]" style={{ color: GRAY_500 }}>
          {rows.length} riders
        </span>
      </div>

      <SectionTitle>Riders</SectionTitle>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left" style={{ color: GRAY_500 }}>
              <th className="px-4 py-2 font-medium">Rider</th>
              <th className="px-2 py-2 font-medium">Cat</th>
              <th className="px-2 py-2 font-medium hidden md:table-cell">Team</th>
              {sortBtn("cost", "Cost")}
              {sortBtn("total", "Points")}
              {sortBtn("value", "Pts/★")}
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowPair
                key={r.id}
                rider={r}
                stages={stages}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RowPair({ rider, stages, expanded, onToggle }) {
  return (
    <>
      <tr
        className="border-t cursor-pointer"
        style={{ borderColor: GRAY_200, color: INK, background: expanded ? "var(--gray-50)" : undefined }}
        onClick={onToggle}
      >
        <td className="px-4 py-1.5 font-medium whitespace-nowrap">{rider.name}</td>
        <td className="px-2 py-1.5"><CatChip cat={rider.cat} /></td>
        <td className="px-2 py-1.5 hidden md:table-cell" style={{ color: GRAY_500 }}>
          {teamName(rider)}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">{rider.cost}★</td>
        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtN(rider.total)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
          {(rider.total / rider.cost).toFixed(1)}
        </td>
        <td className="px-4 py-1.5 hidden sm:table-cell">
          <Sparkline rider={rider} stages={stages} />
        </td>
      </tr>
      {expanded && stages.length > 0 && <RiderDetail rider={rider} stages={stages} />}
    </>
  );
}
