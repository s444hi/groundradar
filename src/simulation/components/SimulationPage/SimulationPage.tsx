import { useMemo } from "react";
import cropsJson from "../../data/crops.json";
import demoFieldJson from "../../fixtures/demo-field.json";
import { runSimulation } from "../../engine";
import { getFrostWeeks } from "../../engine/frost";
import { buildTimeline } from "../../engine/timeline";
import type { CropsById, FieldJson } from "../../engine/types";
import Disclaimer from "../Disclaimer/Disclaimer";
import RotationLane from "../RotationLane/RotationLane";
import type { ScoredRotationStrategy } from "../types";

const crops = cropsJson.crops as unknown as CropsById;
const demoField = demoFieldJson as unknown as FieldJson;

const pageStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "48px 24px",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-sans)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  fontSize: "48px",
  margin: "0 0 16px 0",
};

export default function SimulationPage() {
  const scoredField = useMemo(() => runSimulation(demoField), []);
  const baselineStrategy = scoredField.rotation_strategies[0] as ScoredRotationStrategy;

  const weeklyTimeline = useMemo(() => {
    const frostWeeks = getFrostWeeks(demoField.climate_data.frost_dates);
    return buildTimeline(baselineStrategy, crops, frostWeeks, 3);
  }, [baselineStrategy]);

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>Ground Radar</h1>
      <Disclaimer />
      <RotationLane strategy={baselineStrategy} weeklyTimeline={weeklyTimeline} crops={crops} />
    </div>
  );
}
