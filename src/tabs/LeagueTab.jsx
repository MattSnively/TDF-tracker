/* League tab: how the six managers in Matt's Tissot league stack up — current
   standings, and each manager's score stage by stage (toggleable to the
   cumulative race for the lead). Clicking a stage on the chart re-ranks the
   standings table on that stage alone. Numbers are the official game scores;
   the per-stage series sums exactly to the standings total. */

import { useMemo, useState } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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

export function LeagueTab() {
  const league = getLeague();
  const [view, setView] = useState("stage");
  // null = overall standings; a stage number = that stage broken out.
  const [selectedStage, setSelectedStage] = useState(null);
  const managers = league.managers ?? [];
  const stages = league.stages ?? [];

  /* Colour is keyed to the manager, not the row, so identity holds when the
     table re-sorts into a single stage's order. Assigned by overall position. */
  const colorByManager = useMemo(
    () =>
      Object.fromEntries(
        managers.map((m, i) => [m.manager, SERIES_COLORS[i % SERIES_COLORS.length]]),
      ),
    [managers],
  );

  /* One shape for both table modes: overall standings, or a single stage
     re-ranked on that stage's points. */
  const rows = useMemo(() => {
    const base = managers.map((m) => ({
      manager: m.manager,
      team: m.team,
      me: m.me,
      color: colorByManager[m.manager],
      points: selectedStage == null ? m.total : (m.stages[String(selectedStage)] ?? 0),
      overallPosition: m.position,
    }));
    if (selectedStage != null) base.sort((a, b) => b.points - a.points);
    return base.map((r, i) => ({ ...r, rank: selectedStage == null ? r.overallPosition : i + 1 }));
  }, [managers, colorByManager, selectedStage]);

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

      <SectionTitle
        right={
          selectedStage != null && (
            <button
              onClick={() => setSelectedStage(null)}
              className="px-2 py-1 text-[11px] font-medium rounded border"
              style={{ color: GRAY_500, borderColor: GRAY_200 }}
            >
              ← Back to overall
            </button>
          )
        }
      >
        {selectedStage == null ? "Current standings" : `Stage ${selectedStage} points`}
      </SectionTitle>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left" style={{ color: GRAY_500 }}>
              <th className="px-4 py-2 font-medium w-8">#</th>
              <th className="px-2 py-2 font-medium">Manager</th>
              <th className="px-2 py-2 font-medium hidden sm:table-cell">Points</th>
              <th className="px-4 py-2 font-medium text-right">
                {selectedStage == null ? "Total" : "Stage"}
              </th>
              <th className="px-4 py-2 font-medium text-right whitespace-nowrap">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.manager}
                className="border-t"
                style={{ borderColor: GRAY_200, color: INK, background: r.me ? ACCENT_SOFT : undefined }}
              >
                <td className="px-4 py-1.5 tabular-nums" style={{ color: GRAY_500 }}>{r.rank}</td>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                    style={{ background: r.color }}
                    aria-hidden="true"
                  />
                  {r.manager}
                  {r.team && r.team !== r.manager && (
                    <span className="ml-2 text-[11px]" style={{ color: GRAY_500 }}>{r.team}</span>
                  )}
                </td>
                {/* Ranked bar in-row: keeps the leaderboard order readable while
                    the exact figures stay in the adjacent columns. Scaled to the
                    top score in whichever view is showing. */}
                <td className="px-2 py-1.5 hidden sm:table-cell w-[45%]">
                  <div className="h-2 rounded-sm" style={{ background: "var(--gray-100)" }}>
                    <div
                      className="h-2 rounded-sm"
                      style={{
                        width: `${rows[0].points ? (r.points / rows[0].points) * 100 : 0}%`,
                        background: r.color,
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(r.points)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
                  {i === 0 ? "—" : `−${fmtN(rows[0].points - r.points)}`}
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
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
            onClick={(e) => {
              const n = Number(e?.activeLabel);
              // Clicking the selected stage again clears the breakout.
              if (Number.isFinite(n)) setSelectedStage((cur) => (cur === n ? null : n));
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid stroke="var(--gray-200)" vertical={false} />
            {selectedStage != null && (
              <ReferenceLine
                x={selectedStage}
                stroke="var(--ink)"
                strokeDasharray="3 3"
                label={{ value: `S${selectedStage}`, position: "top", fontSize: 11, fill: "var(--ink)" }}
              />
            )}
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
                stroke={colorByManager[m.manager]}
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
          Your line is drawn heavier. Click a stage to break it out in the table above.
        </div>
      </Card>
    </div>
  );
}
