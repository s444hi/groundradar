import { useCountUp } from "../RotationLane/useCountUp";
import ScoreBadge from "../ScoreBadge/ScoreBadge";
import type { PlaybackApi } from "../Timeline/usePlayback";
import type { PlantingResult } from "../../engine/plant";

export interface PlantScoreCardProps {
  result: PlantingResult;
  playback: PlaybackApi;
}

const SCORE_COUNT_UP_MS = 600;

const scoreRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "32px",
  flexWrap: "wrap",
  marginBottom: "24px",
};

const smallScoreRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
  flex: 1,
};

const reasonsListStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--color-text-muted)",
  margin: "0 0 24px 0",
  paddingLeft: "18px",
};

/** Same visual style as a RotationLane's score row: a big overall numeral, small mini scores, then plain-word reasons. */
export default function PlantScoreCard({ result, playback }: PlantScoreCardProps) {
  const [overall, seasonFit, water, frostRisk, soil, income] = useCountUp(
    [result.overallScore, result.seasonFitScore, result.waterScore, result.frostRiskScore, result.soilScore, result.incomeScore],
    SCORE_COUNT_UP_MS,
    playback.isFinished,
  );

  return (
    <div>
      <div style={scoreRowStyle}>
        <ScoreBadge label="Overall success" value={overall} size="large" />
        <div style={smallScoreRowStyle}>
          <ScoreBadge label="Season fit" value={seasonFit} size="small" colorByScore />
          <ScoreBadge label="Water" value={water} size="small" colorByScore />
          <ScoreBadge label="Frost risk" value={frostRisk} size="small" colorByScore />
          <ScoreBadge label="Soil" value={soil} size="small" colorByScore />
          <ScoreBadge label="Income" value={income} size="small" colorByScore />
        </div>
      </div>
      <ul style={reasonsListStyle}>
        {result.reasons.map((reason) => (
          <li key={reason.text}>{reason.text}</li>
        ))}
      </ul>
    </div>
  );
}
