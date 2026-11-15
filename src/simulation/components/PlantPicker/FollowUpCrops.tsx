import PixelSprite from "../PixelSprite";
import { getCropSpriteSet } from "../sprites";
import type { FollowUpSuggestion } from "../../engine/plant";
import type { CropsById } from "../../engine/types";

export interface FollowUpCropsProps {
  suggestions: FollowUpSuggestion[];
  crops: CropsById;
}

const FOLLOWUP_PIXEL_SIZE = 2;

const sectionStyle: React.CSSProperties = {
  marginTop: "8px",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  fontSize: "18px",
  margin: "0 0 12px 0",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 14px",
  background: "var(--color-cream)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  maxWidth: "260px",
};

const spriteBoxStyle: React.CSSProperties = {
  flexShrink: 0,
  height: "32px",
  display: "flex",
  alignItems: "flex-end",
};

const nameStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  color: "var(--color-text)",
};

const reasonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "11px",
  color: "var(--color-text-muted)",
};

/** Up to 3 good follow-up crops (different families, nitrogen fixers preferred after a heavy feeder), each with a one-line reason. */
export default function FollowUpCrops({ suggestions, crops }: FollowUpCropsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div style={sectionStyle}>
      <h3 style={titleStyle}>Good crops to follow it</h3>
      <div style={listStyle}>
        {suggestions.map(({ cropId, reason }) => {
          const crop = crops[cropId];
          const sprite = getCropSpriteSet(cropId).full;
          return (
            <div key={cropId} style={cardStyle}>
              <span style={spriteBoxStyle}>
                <PixelSprite grid={sprite.rows} pixelSize={FOLLOWUP_PIXEL_SIZE} />
              </span>
              <span>
                <div style={nameStyle}>{crop.display_name}</div>
                <div style={reasonStyle}>{reason}</div>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
