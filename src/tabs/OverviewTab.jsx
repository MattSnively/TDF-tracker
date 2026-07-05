/* Overview tab: race-at-a-glance KPIs, current jersey holders, the top fantasy
   scorers by official points (stacked by point source), and Matt's standing. */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, SectionTitle, StatTile } from "../components/Primitives.jsx";
import {
  getMyTeam,
  getStages,
  isPreRace,
  ridersByTotal,
  teamName,
} from "../data.js";
import {
  BREAKDOWN_SOURCES,
  GRAY_500,
  INK,
  JERSEYS,
  fmtN,
} from "../tokens.js";

function JerseyRow({ stage }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Object.entries(JERSEYS).map(([key, j]) => {
        const holder = stage?.jerseys?.[key];
        return (
          <Card key={key}>
            <div className="text-[11px] font-medium" style={{ color: GRAY_500 }}>
              {j.emoji} {j.label}
            </div>
            <div className="text-[15px] font-semibold mt-1 truncate" style={{ color: INK }}>
              {holder?.name ?? "—"}
            </div>
            <div className="text-[11px] truncate" style={{ color: GRAY_500 }}>{holder?.team ?? ""}</div>
          </Card>
        );
      })}
    </div>
  );
}

/** Top-N scorers as horizontal bars stacked by point source. */
function TopScorers() {
  const top = ridersByTotal().slice(0, 12);
  const data = top.map((r) => ({
    name: r.name.replace(/^[A-Z]+\.\s*/, ""),
    ...r.breakdown,
  }));
  return (
    <Card>
      <ResponsiveContainer width="100%" height={Math.max(320, top.length * 26)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--gray-200)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--gray-500)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130}
            tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--gray-300)" }} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--ink-surface)", border: "none", borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: "#fff" }} labelStyle={{ color: "#aaa" }}
            cursor={{ fill: "var(--gray-100)" }}
            formatter={(v, key) => [fmtN(v), BREAKDOWN_SOURCES.find((s) => s.key === key)?.label ?? key]}
          />
          {BREAKDOWN_SOURCES.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="pts" fill={s.color}
              radius={i === BREAKDOWN_SOURCES.length - 1 ? [0, 4, 4, 0] : 0} barSize={14} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px]" style={{ color: INK }}>
        {BREAKDOWN_SOURCES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function OverviewTab({ setTab }) {
  const stages = getStages();
  const latest = stages[stages.length - 1];
  // Jerseys come from letour's general standings, captured for the latest
  // stage scraped each evening; fall back to the most recent stage that has them.
  const jerseyStage = [...stages].reverse().find((s) => Object.keys(s.jerseys ?? {}).length > 0);
  const top = ridersByTotal()[0];
  const my = getMyTeam();
  const myRow = my.standings.find((s) => s.me);

  if (isPreRace()) {
    return (
      <div className="pt-4">
        <Card className="text-center py-8">
          <div className="text-[22px] mb-1">🚴</div>
          <div className="text-[13px] font-medium" style={{ color: INK }}>
            The 2026 Tour hasn't produced results yet.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Stages complete" value={`${stages.length} / 21`}
          sub={latest ? latest.name : ""} />
        <StatTile label="Latest stage winner" value={latest?.top10?.[0]?.name ?? "—"}
          sub={latest?.top10?.[0]?.team ?? ""} />
        <StatTile label="Top fantasy scorer" value={top?.name ?? "—"}
          sub={top ? `${fmtN(top.total)} pts · ${top.cost ?? "?"}★` : ""} />
        <StatTile label="My rank" value={myRow ? `#${myRow.position}` : "—"}
          sub={myRow ? `${fmtN(myRow.total)} pts in my league` : "build a team →"} />
      </div>

      {jerseyStage && (
        <>
          <SectionTitle>Jersey holders — {jerseyStage.name}</SectionTitle>
          <JerseyRow stage={jerseyStage} />
        </>
      )}

      <SectionTitle
        right={<button className="text-[11px] underline" style={{ color: GRAY_500 }} onClick={() => setTab("Riders")}>All riders →</button>}
      >
        Top fantasy scorers — official points by source
      </SectionTitle>
      <TopScorers />

      <div className="text-[11px] mt-4" style={{ color: GRAY_500 }}>
        Fantasy points are the official Tissot game scores.
      </div>
    </div>
  );
}
