/* Top header: brand, tab navigation, dark-mode toggle.
   Same interaction pattern as the CarsAndBidsData dashboard header. */

import {
  ACCENT,
  CARD_BG,
  GRAY_200,
  GRAY_500,
  INK,
  INK_SURFACE,
} from "../tokens.js";

const TABS = ["Overview", "Stages", "Riders", "Teams", "Value", "My Team"];

export function Header({ tab, setTab, isDark, toggleDark, stagesDone }) {
  return (
    <header
      className="border-b sticky top-0 z-40"
      style={{ background: CARD_BG, borderColor: GRAY_200 }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ background: ACCENT }}
            />
            <span
              className="text-[14px] font-extrabold tracking-tight whitespace-nowrap"
              style={{ color: INK, letterSpacing: "-0.02em" }}
            >
              TDF<span style={{ color: GRAY_500 }}>·</span>2026
            </span>
            <span
              className="hidden sm:inline text-[11px] ml-2 whitespace-nowrap"
              style={{ color: GRAY_500 }}
            >
              {stagesDone > 0
                ? `${stagesDone} of 21 stages complete`
                : "Grand Départ · Barcelona · July 4"}
            </span>
          </div>
          <button
            onClick={toggleDark}
            className="text-[11px] px-2 py-1 rounded"
            style={{ background: INK_SURFACE, color: "white" }}
            aria-label="Toggle dark mode"
          >
            {isDark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
        {/* Tab bar — horizontally scrollable on small screens */}
        <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-[12px] font-medium whitespace-nowrap border-b-2"
              style={
                tab === t
                  ? { color: INK, borderColor: ACCENT }
                  : { color: GRAY_500, borderColor: "transparent" }
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
