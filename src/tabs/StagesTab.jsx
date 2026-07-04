/* Stages tab: pick a stage, see its result, jersey standings that evening,
   and the biggest fantasy hauls of the day. */

import { useState } from "react";

import { Card, PreRaceNotice, SectionTitle } from "../components/Primitives.jsx";
import { getRiders, getStages, isPreRace } from "../data.js";
import {
  ACCENT,
  GRAY_200,
  GRAY_500,
  INK,
  INK_SURFACE,
  JERSEYS,
  fmtN,
  stageDate,
} from "../tokens.js";

function StagePicker({ stages, selected, onSelect }) {
  return (
    <div className="flex gap-1 overflow-x-auto py-1">
      {stages.map((s) => (
        <button
          key={s.n}
          onClick={() => onSelect(s.n)}
          className="px-2.5 py-1.5 text-[12px] font-medium rounded whitespace-nowrap"
          style={
            selected === s.n
              ? { background: INK_SURFACE, color: "white" }
              : { background: "var(--gray-100)", color: GRAY_500 }
          }
        >
          S{s.n}
        </button>
      ))}
    </div>
  );
}

export function StagesTab() {
  const stages = getStages();
  const [selected, setSelected] = useState(stages[stages.length - 1]?.n ?? 1);

  if (isPreRace()) {
    return (
      <div className="pt-4">
        <PreRaceNotice>Stage results will appear here after stage 1.</PreRaceNotice>
      </div>
    );
  }

  const stage = stages.find((s) => s.n === selected) ?? stages[stages.length - 1];

  // Biggest fantasy hauls for this stage across all riders.
  const hauls = getRiders()
    .map((r) => ({ r, pts: r.pts[String(stage.n)] ?? 0 }))
    .filter((x) => x.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10);

  return (
    <div className="pt-4">
      <StagePicker stages={stages} selected={stage.n} onSelect={setSelected} />

      <SectionTitle>
        Stage {stage.n} · {stageDate(stage.n)}
        {stage.combativity && (
          <span className="text-[11px] font-normal ml-3" style={{ color: GRAY_500 }}>
            Most combative: {stage.combativity.name}
          </span>
        )}
      </SectionTitle>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Stage result */}
        <Card className="p-0 overflow-x-auto">
          <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: GRAY_500 }}>
            Stage result
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {stage.top10.map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                  <td className="px-4 py-1.5 w-8 font-semibold" style={{ color: i === 0 ? "var(--accent-deep)" : GRAY_500 }}>
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5 font-medium">{row.name}</td>
                  <td className="px-2 py-1.5 hidden sm:table-cell" style={{ color: GRAY_500 }}>{row.team}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
                    {i === 0 ? row.time : row.gap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* GC after this stage (hidden if the general snapshot is missing) */}
        {stage.gcTop10?.length > 0 && (
        <Card className="p-0 overflow-x-auto">
          <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: GRAY_500 }}>
            {JERSEYS.gc.emoji} General classification after stage {stage.n}
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {stage.gcTop10.map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                  <td className="px-4 py-1.5 w-8 font-semibold" style={{ color: i === 0 ? "var(--accent-deep)" : GRAY_500 }}>
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5 font-medium">{row.name}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
                    {i === 0 ? "" : row.gap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        )}
      </div>

      <SectionTitle>Biggest fantasy hauls — stage {stage.n}</SectionTitle>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left" style={{ color: GRAY_500 }}>
              <th className="px-4 py-2 font-medium">Rider</th>
              <th className="px-2 py-2 font-medium text-right">Stage pts</th>
              <th className="px-2 py-2 font-medium text-right">Jersey bonus</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {hauls.map(({ r, pts }) => {
              const [stagePts, bonusPts] = r.split[String(stage.n)] ?? [0, 0];
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                  <td className="px-4 py-1.5 font-medium">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtN(stagePts)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>
                    {fmtN(bonusPts)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold" style={{ color: "var(--accent-deep)" }}>
                    {fmtN(pts)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {stage.teamTop5?.length > 0 && (
        <>
          <SectionTitle>Team classification — top 5</SectionTitle>
          <Card>
            <ol className="text-[12px] space-y-1" style={{ color: INK }}>
              {stage.teamTop5.map((t, i) => (
                <li key={i}>
                  <span className="font-semibold mr-2" style={{ color: GRAY_500 }}>{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </div>
  );
}
