/* Teams tab: pro-team aggregates — total fantasy points by team with each
   rider's contribution, and the roster cost structure per team. */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CatChip, PreRaceNotice, SectionTitle } from "../components/Primitives.jsx";
import { isPreRace, teamAggregates } from "../data.js";
import { GRAY_200, GRAY_500, INK, fmtN } from "../tokens.js";

// Single-series bar: one hue (sequential job = magnitude), thin marks,
// rounded data ends, recessive grid.
const BAR_COLOR = "#2a78d6";

export function TeamsTab() {
  const teams = teamAggregates();

  if (isPreRace()) {
    return (
      <div className="pt-4">
        <PreRaceNotice>Team standings appear once stage results exist.</PreRaceNotice>
      </div>
    );
  }

  const chartData = teams.map((t) => ({ name: t.name, total: t.total }));

  return (
    <div className="pt-4">
      <SectionTitle>Total fantasy points by team</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={Math.max(300, teams.length * 26)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--gray-200)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--gray-500)" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={190}
              tick={{ fontSize: 11, fill: "var(--ink)" }}
              axisLine={{ stroke: "var(--gray-300)" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: "var(--ink-surface)", border: "none", borderRadius: 6, fontSize: 12 }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#aaa" }}
              formatter={(v) => [fmtN(v), "points"]}
              cursor={{ fill: "var(--gray-100)" }}
            />
            <Bar dataKey="total" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <SectionTitle>Rider contributions</SectionTitle>
      <TeamCards teams={teams} />
    </div>
  );
}

function TeamCards({ teams, preRace = false }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {teams.map((t) => (
        <Card key={t.name} className="p-0">
          <div className="px-4 py-2 border-b flex items-baseline justify-between" style={{ borderColor: GRAY_200 }}>
            <span className="text-[12px] font-semibold truncate" style={{ color: INK }}>{t.name}</span>
            {!preRace && (
              <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--accent-deep)" }}>
                {fmtN(t.total)}
              </span>
            )}
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              {t.riders.map((r) => (
                <tr key={r.id} className="border-t first:border-t-0" style={{ borderColor: "var(--gray-100)", color: INK }}>
                  <td className="px-4 py-1 font-medium whitespace-nowrap">{r.name}</td>
                  <td className="px-1 py-1"><CatChip cat={r.cat} /></td>
                  <td className="px-2 py-1 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost != null ? `${r.cost}★` : "—"}</td>
                  <td className="px-4 py-1 text-right tabular-nums font-semibold">
                    {preRace ? "" : fmtN(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
