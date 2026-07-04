/* Small shared UI primitives — cards, stat tiles, section titles, chips.
   Ported from the CarsAndBidsData dashboard's visual system. */

import {
  CARD_BG,
  CAT_COLORS,
  CAT_SHORT,
  GRAY_200,
  GRAY_500,
  INK,
} from "../tokens.js";

/** White (theme-aware) card with hairline border. */
export function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-lg border p-4 ${className}`}
      style={{ background: CARD_BG, borderColor: GRAY_200, ...style }}
    >
      {children}
    </div>
  );
}

/** KPI stat tile: big number, small label, optional sub-line. */
export function StatTile({ label, value, sub }) {
  return (
    <Card>
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: GRAY_500 }}>
        {label}
      </div>
      <div className="text-[26px] font-bold leading-tight mt-1" style={{ color: INK }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5" style={{ color: GRAY_500 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

/** Section heading with optional right-aligned extra content. */
export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-baseline justify-between mt-6 mb-2">
      <h2 className="text-[14px] font-semibold" style={{ color: INK }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

/** Colored category chip: colored dot + short label (color never alone). */
export function CatChip({ cat }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ color: INK, background: "var(--gray-100)" }}
      title={cat}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: CAT_COLORS[cat] }}
      />
      {CAT_SHORT[cat]}
    </span>
  );
}

/** Empty-state banner used by tabs before race data exists. */
export function PreRaceNotice({ children }) {
  return (
    <Card className="text-center py-8">
      <div className="text-[22px] mb-1">🚴</div>
      <div className="text-[13px] font-medium" style={{ color: INK }}>
        {children ?? "The 2026 Tour hasn't produced results yet."}
      </div>
      <div className="text-[12px] mt-1" style={{ color: GRAY_500 }}>
        Stage results and fantasy points appear here after each stage — data
        updates automatically every evening during the Tour.
      </div>
    </Card>
  );
}
