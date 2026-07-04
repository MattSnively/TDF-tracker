/* Overview tab: race-at-a-glance KPIs, jersey holders, cumulative fantasy
   points race chart for the top riders, latest stage highlight.
   Pre-race it shows roster composition so the page is useful on day zero. */

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

import {
  Card,
  CatChip,
  PreRaceNotice,
  SectionTitle,
  StatTile,
} from "../components/Primitives.jsx";
import {
  cumulativeSeries,
  getMeta,
  getRiders,
  getStages,
  isPreRace,
  ridersByTotal,
  teamName,
} from "../data.js";
import {
  CARD_BG,
  CAT_COLORS,
  CATEGORIES,
  GRAY_200,
  GRAY_500,
  INK,
  JERSEYS,
  SERIES_COLORS,
  fmtN,
  stageDate,
} from "../tokens.js";

/** Jersey holder chips row (icon + label + name — identity never color-alone). */
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
            <div className="text-[11px] truncate" style={{ color: GRAY_500 }}>
              {holder?.team ?? ""}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CumulativeChart() {
  const top = ridersByTotal().slice(0, 6);
  const series = cumulativeSeries(top.map((r) => r.id));
  if (series.length < 1) return null;
  return (
    <Card>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={series} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--gray-200)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="stage"
            tickFormatter={(n) => `S${n}`}
            tick={{ fontSize: 11, fill: "var(--gray-500)" }}
            axisLine={{ stroke: "var(--gray-300)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--gray-500)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "var(--ink-surface)",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
            }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#aaa" }}
            labelFormatter={(n) => `Stage ${n} · ${stageDate(n)}`}
            formatter={(value, key) => [fmtN(value), top.find((r) => r.id === key)?.name ?? key]}
          />
          <Legend
            formatter={(key) => (
              <span style={{ color: INK, fontSize: 12 }}>
                {top.find((r) => r.id === key)?.name ?? key}
              </span>
            )}
          />
          {top.map((r, i) => (
            <Line
              key={r.id}
              dataKey={r.id}
              stroke={SERIES_COLORS[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Pre-race view: roster composition stats. */
function RosterOverview() {
  const riders = getRiders();
  const byCat = CATEGORIES.map((cat) => ({
    cat,
    n: riders.filter((r) => r.cat === cat).length,
  }));
  const priciest = [...riders].sort((a, b) => b.cost - a.cost).slice(0, 8);
  return (
    <>
      <SectionTitle>Rider pool by category</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {byCat.map(({ cat, n }) => (
          <Card key={cat}>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[cat] }} />
              <span className="text-[12px] font-medium" style={{ color: INK }}>{cat}</span>
            </div>
            <div className="text-[24px] font-bold mt-1" style={{ color: INK }}>{n}</div>
            <div className="text-[11px]" style={{ color: GRAY_500 }}>riders</div>
          </Card>
        ))}
      </div>
      <SectionTitle>Highest-priced riders</SectionTitle>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left" style={{ color: GRAY_500 }}>
              <th className="px-4 py-2 font-medium">Rider</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Team</th>
              <th className="px-4 py-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {priciest.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-2 py-2"><CatChip cat={r.cat} /></td>
                <td className="px-2 py-2" style={{ color: GRAY_500 }}>{teamName(r)}</td>
                <td className="px-4 py-2 text-right font-semibold">{r.cost}★</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

export function OverviewTab({ setTab }) {
  const meta = getMeta();
  const stages = getStages();
  const latest = stages[stages.length - 1];
  const riders = getRiders();
  const topRider = ridersByTotal()[0];

  if (isPreRace()) {
    return (
      <div className="pt-4">
        <PreRaceNotice>
          The 2026 Tour de France starts today — first results land here tonight.
        </PreRaceNotice>
        <RosterOverview />
      </div>
    );
  }

  return (
    <div className="pt-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Stages complete"
          value={`${stages.length} / 21`}
          sub={latest ? `Latest: Stage ${latest.n} · ${stageDate(latest.n)}` : ""}
        />
        <StatTile
          label="Latest stage winner"
          value={latest?.top10?.[0]?.name ?? "—"}
          sub={latest?.top10?.[0]?.team ?? ""}
        />
        <StatTile
          label="Top fantasy scorer"
          value={topRider?.name ?? "—"}
          sub={topRider ? `${fmtN(topRider.total)} pts · ${topRider.cost}★` : ""}
        />
        <StatTile
          label="Riders remaining"
          value={fmtN(latest?.finishers ?? riders.length)}
          sub={`of ${riders.length} starters`}
        />
      </div>

      {Object.keys(latest?.jerseys ?? {}).length > 0 && (
        <>
          <SectionTitle>Jersey holders after stage {latest?.n}</SectionTitle>
          <JerseyRow stage={latest} />
        </>
      )}

      <SectionTitle
        right={
          <button className="text-[11px] underline" style={{ color: GRAY_500 }} onClick={() => setTab("Riders")}>
            All riders →
          </button>
        }
      >
        Fantasy points race — top 6 riders
      </SectionTitle>
      <CumulativeChart />

      <div className="text-[11px] mt-4" style={{ color: GRAY_500 }}>
        {meta.breakawayNote}
      </div>
    </div>
  );
}
