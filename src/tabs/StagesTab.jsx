/* Stages tab: pick a stage and see the real race result and GC (from
   letour.fr) alongside Matt's official fantasy scorecard for that stage. */

import { useState } from "react";

import { Card, PreRaceNotice, SectionTitle } from "../components/Primitives.jsx";
import { getMyTeam, getStages, isPreRace } from "../data.js";
import { GRAY_200, GRAY_500, INK, INK_SURFACE, JERSEYS, fmtN } from "../tokens.js";

function StagePicker({ stages, selected, onSelect }) {
  return (
    <div className="flex gap-1 overflow-x-auto py-1">
      {stages.map((s) => (
        <button key={s.n} onClick={() => onSelect(s.n)}
          className="px-2.5 py-1.5 text-[12px] font-medium rounded whitespace-nowrap"
          style={selected === s.n
            ? { background: INK_SURFACE, color: "white" }
            : { background: "var(--gray-100)", color: GRAY_500 }}>
          S{s.n}
        </button>
      ))}
    </div>
  );
}

export function StagesTab() {
  const stages = getStages();
  const my = getMyTeam();
  const [selected, setSelected] = useState(stages[stages.length - 1]?.n ?? 1);

  if (isPreRace()) {
    return <div className="pt-4"><PreRaceNotice>Stage results will appear here after stage 1.</PreRaceNotice></div>;
  }

  const stage = stages.find((s) => s.n === selected) ?? stages[stages.length - 1];
  const mySheet = my.stages[String(stage.n)];

  return (
    <div className="pt-4">
      <StagePicker stages={stages} selected={stage.n} onSelect={setSelected} />

      <SectionTitle>
        {stage.name}
        {stage.combativity && (
          <span className="text-[11px] font-normal ml-3" style={{ color: GRAY_500 }}>
            Most combative: {stage.combativity.name}
          </span>
        )}
      </SectionTitle>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-0 overflow-x-auto">
          <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: GRAY_500 }}>Stage result</div>
          <table className="w-full text-[12px]"><tbody>
            {stage.top10.map((row, i) => (
              <tr key={i} className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                <td className="px-4 py-1.5 w-8 font-semibold" style={{ color: i === 0 ? "var(--accent-deep)" : GRAY_500 }}>{i + 1}</td>
                <td className="px-2 py-1.5 font-medium">{row.name}</td>
                <td className="px-2 py-1.5 hidden sm:table-cell" style={{ color: GRAY_500 }}>{row.team}</td>
                <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{i === 0 ? row.time : row.gap}</td>
              </tr>
            ))}
          </tbody></table>
        </Card>

        {stage.gcTop10?.length > 0 && (
          <Card className="p-0 overflow-x-auto">
            <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: GRAY_500 }}>
              {JERSEYS.gc.emoji} General classification after {stage.name.split(" - ")[0] || `stage ${stage.n}`}
            </div>
            <table className="w-full text-[12px]"><tbody>
              {stage.gcTop10.map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                  <td className="px-4 py-1.5 w-8 font-semibold" style={{ color: i === 0 ? "var(--accent-deep)" : GRAY_500 }}>{i + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{row.name}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{i === 0 ? "" : row.gap}</td>
                </tr>
              ))}
            </tbody></table>
          </Card>
        )}
      </div>

      {mySheet && (
        <>
          <SectionTitle right={<span className="text-[12px] font-semibold" style={{ color: "var(--accent-deep)" }}>{fmtN(mySheet.total)} pts</span>}>
            My team this stage
          </SectionTitle>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-[12px]"><tbody>
              {mySheet.riders.map((r, i) => (
                <tr key={i} className="border-t first:border-t-0" style={{ borderColor: GRAY_200, color: INK }}>
                  <td className="px-4 py-1.5">{r.captain && <span title="Shimano Bonus (captain, ×2 stage points)">⭐</span>}</td>
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: GRAY_500 }}>{r.cost}★</td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(r.points)}</td>
                </tr>
              ))}
              {mySheet.bonusQuestion > 0 && (
                <tr className="border-t" style={{ borderColor: GRAY_200, color: INK }}>
                  <td /><td className="px-2 py-1.5" style={{ color: GRAY_500 }} colSpan={2}>Tissot Bonus Question</td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtN(mySheet.bonusQuestion)}</td>
                </tr>
              )}
            </tbody></table>
          </Card>
        </>
      )}
    </div>
  );
}
