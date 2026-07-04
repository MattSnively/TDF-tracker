/* Value tab: cost-vs-points scatter (who's overdelivering for their price),
   value leaderboard, and the best-possible squad within game constraints. */

import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CatChip, PreRaceNotice, SectionTitle } from "../components/Primitives.jsx";
import { getRiders, isPreRace, optimalTeam, ridersByTotal, teamName } from "../data.js";
import {
  CAT_COLORS,
  CATEGORIES,
  CATEGORY_CAPS,
  GRAY_200,
  GRAY_500,
  INK,
  STAR_BUDGET,
  TEAM_SIZE,
  fmtN,
} from "../tokens.js";

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded text-[12px]"
      style={{ background: "var(--ink-surface)", color: "white" }}
    >
      <div className="font-semibold">{d.name}</div>
      <div style={{ color: "#bbb" }}>
        {d.cost}★ · {fmtN(d.total)} pts · {(d.total / d.cost).toFixed(1)} pts/★
      </div>
    </div>
  );
}

export function ValueTab() {
  if (isPreRace()) {
    return (
      <div className="pt-4">
        <PreRaceNotice>Value analysis needs at least one stage of results.</PreRaceNotice>
      </div>
    );
  }

  const riders = getRiders().filter((r) => r.total > 0);
  const byCat = CATEGORIES.map((cat) => ({
    cat,
    data: riders.filter((r) => r.cat === cat),
  }));

  const leaderboard = [...riders]
    .sort((a, b) => b.total / b.cost - a.total / a.cost)
    .slice(0, 15);

  const best = optimalTeam(STAR_BUDGET, CATEGORY_CAPS, TEAM_SIZE);

  return (
    <div className="pt-4">
      <SectionTitle>Cost vs. fantasy points</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 28, left: 0 }}>
            <CartesianGrid stroke="var(--gray-200)" />
            <XAxis
              type="number"
              dataKey="cost"
              name="Cost"
              domain={[4, "dataMax + 1"]}
              tick={{ fontSize: 11, fill: "var(--gray-500)" }}
              axisLine={{ stroke: "var(--gray-300)" }}
              tickLine={false}
              label={{ value: "Star cost", position: "insideBottom", offset: -18, fontSize: 11, fill: "var(--gray-500)" }}
            />
            <YAxis
              type="number"
              dataKey="total"
              name="Points"
              tick={{ fontSize: 11, fill: "var(--gray-500)" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ScatterTooltip />} />
            <Legend
              formatter={(v) => <span style={{ color: INK, fontSize: 12 }}>{v}</span>}
            />
            {byCat.map(({ cat, data }) => (
              <Scatter key={cat} name={cat} data={data} fill={CAT_COLORS[cat]} shape="circle" />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid md:grid-cols-2 gap-3 mt-2">
        <div>
          <SectionTitle>Best value — points per star</SectionTitle>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-[12px]">
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.id} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                    <td className="px-4 py-1.5 w-8" style={{ color: GRAY_500 }}>{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-1 py-1.5"><CatChip cat={r.cat} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtN(r.total)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums font-bold" style={{ color: "var(--accent-deep)" }}>
                      {(r.total / r.cost).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <SectionTitle>
            Optimal squad so far
            <span className="text-[11px] font-normal ml-2" style={{ color: GRAY_500 }}>
              best legal 8 within {STAR_BUDGET}★
            </span>
          </SectionTitle>
          <Card className="p-0 overflow-x-auto">
            {best ? (
              <>
                <table className="w-full text-[12px]">
                  <tbody>
                    {best.riders.map((r) => (
                      <tr key={r.id} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                        <td className="px-4 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                        <td className="px-1 py-1.5"><CatChip cat={r.cat} /></td>
                        <td className="px-2 py-1.5 hidden sm:table-cell" style={{ color: GRAY_500 }}>{teamName(r)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  className="px-4 py-2 border-t text-[12px] font-semibold flex justify-between"
                  style={{ borderColor: GRAY_200, color: INK }}
                >
                  <span>{best.cost}★ spent</span>
                  <span style={{ color: "var(--accent-deep)" }}>{fmtN(best.total)} pts</span>
                </div>
              </>
            ) : (
              <div className="p-4 text-[12px]" style={{ color: GRAY_500 }}>
                Not enough data yet.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
