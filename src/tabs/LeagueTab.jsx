/* League tab: how the six managers in Matt's Tissot league stack up — current
   standings, and each manager's score stage by stage (toggleable to the
   cumulative race for the lead). Numbers are the official game scores; the
   per-stage series sums exactly to the standings total. */

import { useMemo, useState } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, PreRaceNotice, SectionTitle, StatTile } from "../components/Primitives.jsx";
import { getLeague, isPreRace } from "../data.js";
import {
  ACCENT_SOFT,
  GRAY_200,
  GRAY_500,
  INK,
  SERIES_COLORS,
  fmtN,
} from "../tokens.js";

const VIEWS = [
  { key: "stage", label: "Per stage" },
  { key: "cumulative", label: "Cumulative" },
];

/** Series colour is pinned to standings position so it never shifts between
    the table, the legend and the lines. */
const colorFor = (i) => SERIES_COLORS[i % SERIES_COLORS.length];

export function LeagueTab() {
  const league = getLeague();
  const [view, setView] = useState("stage");
  const managers = league.managers ?? [];
  const stages = league.stages ?? [];

  const chartData = useMemo(() => {
    let running = {};
    return stages.map((n) => {
      const row = { stage: n };
      for (const m of managers) {
        const pts = m.stages[String(n)] ?? 0;
        running[m.manager] = (running[m.manager] ?? 0) + pts;
        row[m.manager] = view === "cumulative" ? running[m.manager] : pts;
      }
      return row;
    });
  }, [managers, stages, view]);

  if (isPreRace() || managers.length === 0) {
    return (
      <div className="pt-4">
        <PreRaceNotice>League scores appear once the first stage is scored.</PreRaceNotice>
      </div>
    );
  }

  const leader = managers[0];
  const me = managers.find((m) => m.me);
  const gap = me ? me.total - leader.total : 0;
  // Biggest single-stage score in the league, for context on the spikes.
  const best = managers.reduce(
    (acc, m) => {
      for (const [n, pts] of Object.entries(m.stages)) {
        if (pts > acc.pts) acc = { pts, manager: m.manager, stage: Number(n) };
      }
      return acc;
    },
    { pts: 0, manager: "", stage: 0 },
  );

  return (
    <div className="pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="League leader" value={leader.manager} sub={`${fmtN(leader.total)} pts`} />
        <StatTile
          label="My position"
          value={me ? `#${me.position}` : "—"}
          sub={me ? (gap === 0 ? "leading the league" : `${fmtN(Math.abs(gap))} pts behind`) : ""}
        />
        <StatTile label="Stages scored" value={stages.length} sub="of 21" />
        <StatTile
          label="Best single stage"
          value={fmtN(best.pts)}
          sub={`${best.manager} · stage ${best.stage}`}
        />
      </div>

      <SectionTitle>Current standings</SectionTitle>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left" style={{ color: GRAY_500 }}>
              <th className="px-4 py-2 font-medium w-8">#</th>
              <th className="px-2 py-2 font-medium">Manager</th>
              <th className="px-2 py-2 font-medium hidden sm:table-cell">Points</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="px-4 py-2 font-medium text-right whitespace-nowrap">Gap</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m, i) => (
              <tr
                key={m.manager}
                className="border-t"
                style={{ borderColor: GRAY_200, color: INK, background: m.me ? ACCENT_SOFT : undefined }}
              >
                <td className="px-4 py-1.5 tabular-nums" style={{ color: GRAY_500 }}>{m.position}</td>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                    style={{ background: colorFor(i) }}
                    aria-hidden="true"
                  />
                  {m.manager}
                  {m.team && m.team !== m.manager && (
                    <span className="ml-2 text-[11px]" style={{ color: GRAY_500 }}>{m.team}</span>
                  )}
                </td>
                {/* Ranked bar in-row: keeps the leaderboard order readable while
                    the exact figures stay in the adjacent columns. */}
                <td className="px-2 py-1.5 hidden sm:table-cell w-[45%]">
                  <div className="h-2 rounded-sm" style={{ background: "var(--gray-100)" }}>
                    <div
                      className="h-2 rounded-sm"
                      style={{ width: `${(m.total / leader.total) * 100}%`, background: colorFor(i) }}
                    />
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(m.total)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
                  {i === 0 ? "—" : `−${fmtN(leader.total - m.total)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle
        right={
          <div className="flex gap-1" role="group" aria-label="Chart view">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className="px-2 py-1 text-[11px] font-medium rounded border"
                style={
                  view === v.key
                    ? { background: "var(--ink-surface)", color: "#fff", borderColor: "var(--ink-surface)" }
                    : { color: GRAY_500, borderColor: GRAY_200 }
                }
              >
                {v.label}
              </button>
            ))}
          </div>
        }
      >
        {view === "cumulative" ? "Cumulative points by stage" : "Points per stage"}
      </SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--gray-200)" vertical={false} />
            <XAxis
              dataKey="stage"
              tick={{ fontSize: 11, fill: "var(--gray-500)" }}
              axisLine={{ stroke: "var(--gray-300)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              width={52}
              domain={[0, "auto"]}
              tick={{ fontSize: 11, fill: "var(--gray-500)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtN}
            />
            <Tooltip
              contentStyle={{ background: "var(--ink-surface)", border: "none", borderRadius: 6, fontSize: 12 }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#aaa" }}
              labelFormatter={(n) => `Stage ${n}`}
              formatter={(v) => fmtN(v)}
              itemSorter={(item) => -item.value}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="plainline" iconSize={16} />
            {managers.map((m, i) => (
              <Line
                key={m.manager}
                type="linear"
                dataKey={m.manager}
                stroke={colorFor(i)}
                strokeWidth={m.me ? 3 : 1.75}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="text-[11px] mt-2" style={{ color: GRAY_500 }}>
          {view === "cumulative"
            ? "Running total after each stage — the gap between lines is the gap in the standings."
            : "Each stage scored on its own. Spikes are mountain and bonus-question days."}{" "}
          Your line is drawn heavier.
        </div>
      </Card>
    </div>
  );
}
