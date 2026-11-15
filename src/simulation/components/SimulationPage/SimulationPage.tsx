import { useMemo } from "react";
import cropsJson from "../../data/crops.json";
import demoFieldJson from "../../fixtures/demo-field.json";
import { runSimulation } from "../../engine";
import { getFrostWeeks } from "../../engine/frost";
import { buildTimeline } from "../../engine/timeline";
import type { CropsById, FieldJson } from "../../engine/types";
import AppFooter from "../AppFooter/AppFooter";
import AppHeader from "../AppHeader/AppHeader";
import RotationLane from "../RotationLane/RotationLane";
import Toolbar from "../Toolbar/Toolbar";
import type { ScoredRotationStrategy } from "../types";

const crops = cropsJson.crops as unknown as CropsById;
const demoField = demoFieldJson as unknown as FieldJson;

const pageStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "32px 24px 48px",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-sans)",
};

export default function SimulationPage() {
  const scoredField = useMemo(() => runSimulation(demoField), []);
  const baselineStrategy = scoredField.rotation_strategies[0] as ScoredRotationStrategy;

  const weeklyTimeline = useMemo(() => {
    const frostWeeks = getFrostWeeks(demoField.climate_data.frost_dates);
    return buildTimeline(baselineStrategy, crops, frostWeeks, 3);
  }, [baselineStrategy]);

  return (
    <>
      <AppHeader fieldProfile={demoField.field_profile} />
      <div style={pageStyle}>
        <Toolbar />
        <RotationLane strategy={baselineStrategy} weeklyTimeline={weeklyTimeline} crops={crops} />
      </div>
      <AppFooter />
    </>
  );
}
