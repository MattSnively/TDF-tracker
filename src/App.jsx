import { useEffect, useState } from "react";

import { Header } from "./components/Header.jsx";
import { loadData, stagesComplete } from "./data.js";
import { MyTeamTab } from "./tabs/MyTeamTab.jsx";
import { OverviewTab } from "./tabs/OverviewTab.jsx";
import { RidersTab } from "./tabs/RidersTab.jsx";
import { StagesTab } from "./tabs/StagesTab.jsx";
import { TeamsTab } from "./tabs/TeamsTab.jsx";
import { ValueTab } from "./tabs/ValueTab.jsx";
import { ACCENT, BG, GRAY_500, INK } from "./tokens.js";

function Shell({ isDark, toggleDark }) {
  const [tab, setTab] = useState("Overview");
  const stagesDone = stagesComplete().length;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: BG,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <Header
        tab={tab}
        setTab={setTab}
        isDark={isDark}
        toggleDark={toggleDark}
        stagesDone={stagesDone}
      />
      <main className="max-w-7xl mx-auto px-4 pb-16">
        {tab === "Overview" && <OverviewTab setTab={setTab} />}
        {tab === "Stages" && <StagesTab />}
        {tab === "Riders" && <RidersTab />}
        {tab === "Teams" && <TeamsTab />}
        {tab === "Value" && <ValueTab />}
        {tab === "My Team" && <MyTeamTab />}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: BG }}>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div style={{ width: 10, height: 10, borderRadius: 99, background: ACCENT }} className="animate-pulse" />
          <div className="text-[14px] font-bold tracking-tight" style={{ color: INK }}>
            TDF·2026
          </div>
        </div>
        <div className="text-[13px]" style={{ color: GRAY_500 }}>
          Loading race data…
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: BG }}>
      <div className="text-center max-w-md">
        <div className="text-[14px] font-semibold mb-2" style={{ color: INK }}>
          Couldn't load race data
        </div>
        <div className="text-[12px]" style={{ color: GRAY_500 }}>
          {String(error)}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ status: "loading", error: null });
  // Default to the viewer's OS preference; toggle persists for the session.
  const [isDark, setIsDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    let cancelled = false;
    loadData(import.meta.env.BASE_URL || "/")
      .then(() => !cancelled && setState({ status: "ready", error: null }))
      .catch((err) => !cancelled && setState({ status: "error", error: err }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState error={state.error} />;
  return (
    <div data-theme={isDark ? "dark" : undefined}>
      <Shell isDark={isDark} toggleDark={() => setIsDark((v) => !v)} />
    </div>
  );
}
