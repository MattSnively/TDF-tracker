/* ============================================================
   DESIGN TOKENS, GAME CONSTANTS & FORMATTERS
   ============================================================ */

// All color tokens reference CSS custom properties defined in index.css
// so theme switching needs zero per-component changes.
export const INK = "var(--ink)";
export const INK_SURFACE = "var(--ink-surface)";
export const CARD_BG = "var(--card-bg)";
export const BG = "var(--bg)";
export const ACCENT = "var(--accent)";
export const ACCENT_SOFT = "var(--accent-soft)";
export const ACCENT_DEEP = "var(--accent-deep)";
export const GRAY_900 = "var(--gray-900)";
export const GRAY_700 = "var(--gray-700)";
export const GRAY_500 = "var(--gray-500)";
export const GRAY_400 = "var(--gray-400)";
export const GRAY_300 = "var(--gray-300)";
export const GRAY_200 = "var(--gray-200)";
export const GRAY_100 = "var(--gray-100)";
export const GRAY_50 = "var(--gray-50)";
export const RED = "var(--red)";
export const GREEN = "var(--green)";

// Rider categories in fixed display order, each with a fixed series color
// (validated categorical palette — hues are assigned to categories, never
// cycled; sub-3:1 slots always ship with visible labels or a table nearby).
export const CATEGORIES = ["Leaders", "Sprinters", "Climbers", "All-rounders"];
export const CAT_COLORS = {
  Leaders: "#2a78d6", // blue
  Sprinters: "#1baf7a", // aqua
  Climbers: "#eda100", // yellow-orange
  "All-rounders": "#4a3aa7", // violet
};
// Short labels for dense UI spots (chips, table cells).
export const CAT_SHORT = {
  Leaders: "LDR",
  Sprinters: "SPR",
  Climbers: "CLM",
  "All-rounders": "ALL",
};

// Jersey identities (semantic, from the race itself — used on badges/chips
// with an icon+label, never as chart series colors).
export const JERSEYS = {
  gc: { label: "Yellow (GC)", color: "#f5c518", emoji: "🟡" },
  points: { label: "Green (Points)", color: "#2e9e4f", emoji: "🟢" },
  kom: { label: "Polka Dot (KOM)", color: "#d94444", emoji: "🔴" },
  youth: { label: "White (Youth)", color: "#9ca3af", emoji: "⚪" },
};

// Series palette for multi-rider line charts (same validated 8-slot set as
// the category colors, extended; assigned to riders in a fixed order).
export const SERIES_COLORS = [
  "#2a78d6", "#1baf7a", "#eda100", "#4a3aa7",
  "#e34948", "#e87ba4", "#eb6834", "#008300",
];

/* ── Fantasy game constants (from the published Tissot rules) ── */
export const TEAM_SIZE = 8;
// Confirmed against the live game: 120 stars.
export const STAR_BUDGET = 120;
// Category caps: max riders per category in a legal squad.
export const CATEGORY_CAPS = {
  Leaders: 3,
  Sprinters: 3,
  Climbers: 3,
  "All-rounders": 5,
};
export const TOTAL_STAGES = 21;

// Official point-source breakdown (from stats criteres, grouped in build_data).
// Fixed display order; colors reuse the validated categorical slots + jerseys.
export const BREAKDOWN_SOURCES = [
  { key: "finishes", label: "Stage finishes", color: "#2a78d6" },
  { key: "climbsSprints", label: "Sprints & climbs", color: "#1baf7a" },
  { key: "combativity", label: "Combativity", color: "#eb6834" },
  { key: "gc", label: "Yellow (GC)", color: "#f5c518" },
  { key: "points", label: "Green (points)", color: "#2e9e4f" },
  { key: "kom", label: "Polka (KOM)", color: "#d94444" },
  { key: "youth", label: "White (youth)", color: "#9ca3af" },
];

/* ── Formatters ── */
export const fmtPts = (n) => `${(n ?? 0).toLocaleString()} pts`;
export const fmtN = (n) => (n ?? 0).toLocaleString();
export const fmtStars = (n) => `${n}★`;

// Stage N of the 2026 Tour maps to a calendar date (Jul 4 start, rest days
// Jul 13, 20 after stages 9 and 15 — official 2026 route).
const START = Date.UTC(2026, 6, 4);
const REST_DAYS_AFTER = [9, 15];
export const stageDate = (n) => {
  let offset = n - 1;
  for (const rest of REST_DAYS_AFTER) if (n > rest) offset += 1;
  const d = new Date(START + offset * 86_400_000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};
