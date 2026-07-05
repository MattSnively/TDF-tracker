/* Riders tab: sortable/filterable table of all riders with their official
   Tissot points, average per stage, cost, value, and a click-through
   breakdown of where each rider's points came from. */

import { useMemo, useState } from "react";

import { Card, CatChip, SectionTitle } from "../components/Primitives.jsx";
import { getRiders, getTeams, teamName } from "../data.js";
import {
  BREAKDOWN_SOURCES,
  CATEGORIES,
  GRAY_200,
  GRAY_500,
  INK,
  fmtN,
} from "../tokens.js";

/** Horizontal stacked bar of a rider's points by source. */
function BreakdownBar({ breakdown, total }) {
  if (!total) return <span style={{ color: GRAY_500 }}>—</span>;
  return (
    <div className="flex h-3 w-full rounded overflow-hidden" style={{ background: "var(--gray-100)" }}>
      {BREAKDOWN_SOURCES.map((s) => {
        const v = breakdown[s.key] ?? 0;
        if (v <= 0) return null;
        return (
          <div
            key={s.key}
            style={{ width: `${(v / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${v}`}
          />
        );
      })}
    </div>
  );
}

function RiderDetail({ rider }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-3" style={{ background: "var(--gray-50)" }}>
        <div className="text-[11px] font-medium mb-2" style={{ color: GRAY_500 }}>
          Points by source ({rider.nbMatchs} stage{rider.nbMatchs === 1 ? "" : "s"})
        </div>
        <div className="mb-2">
          <BreakdownBar breakdown={rider.breakdown} total={rider.total} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: INK }}>
          {BREAKDOWN_SOURCES.filter((s) => (rider.breakdown[s.key] ?? 0) > 0).map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}: <b>{rider.breakdown[s.key]}</b>
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

export function RidersTab() {
  const teams = getTeams();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [team, setTeam] = useState("");
  const [sortKey, setSortKey] = useState("total");
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
      sortKey === "value"
        ? r.cost
          ? r.total / r.cost
          : 0
        : sortKey === "team"
          ? teamName(r)
          : (r[sortKey] ?? 0);
    return [...list].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
    });
  }, [search, cat, team, sortKey, sortDir]);

  const sortBtn = (key, label) => (
    <th
      className="px-2 py-2 font-medium cursor-pointer select-none text-right"
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
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rider…"
          className="px-3 py-1.5 text-[12px] rounded border outline-none"
          style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          className="px-2 py-1.5 text-[12px] rounded border"
          style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)}
          className="px-2 py-1.5 text-[12px] rounded border"
          style={{ background: "var(--card-bg)", borderColor: GRAY_200, color: INK }}>
          <option value="">All teams</option>
          {teams.map((t, i) => <option key={t} value={i}>{t}</option>)}
        </select>
        <span className="text-[11px]" style={{ color: GRAY_500 }}>{rows.length} riders</span>
      </div>

      <SectionTitle right={<span className="text-[11px]" style={{ color: GRAY_500 }}>official Tissot points · click a rider for the breakdown</span>}>
        Riders
      </SectionTitle>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left" style={{ color: GRAY_500 }}>
              <th className="px-4 py-2 font-medium">Rider</th>
              <th className="px-2 py-2 font-medium">Cat</th>
              <th className="px-2 py-2 font-medium hidden md:table-cell">Team</th>
              {sortBtn("cost", "Cost")}
              {sortBtn("total", "Points")}
              {sortBtn("avg", "Avg/stage")}
              {sortBtn("value", "Pts/★")}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowPair key={r.id} rider={r} expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RowPair({ rider, expanded, onToggle }) {
  return (
    <>
      <tr className="border-t cursor-pointer"
        style={{ borderColor: GRAY_200, color: INK, background: expanded ? "var(--gray-50)" : undefined }}
        onClick={onToggle}>
        <td className="px-4 py-1.5 font-medium whitespace-nowrap">{rider.name}</td>
        <td className="px-2 py-1.5"><CatChip cat={rider.cat} /></td>
        <td className="px-2 py-1.5 hidden md:table-cell" style={{ color: GRAY_500 }}>{teamName(rider)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{rider.cost != null ? `${rider.cost}★` : "—"}</td>
        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtN(rider.total)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{rider.avg}</td>
        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
          {rider.cost ? (rider.total / rider.cost).toFixed(1) : "—"}
        </td>
      </tr>
      {expanded && <RiderDetail rider={rider} />}
    </>
  );
}
