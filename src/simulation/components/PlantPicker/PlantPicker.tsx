import PixelSprite from "../PixelSprite";
import { getCropSpriteSet } from "../sprites";
import type { CropId, CropsById, FarmMode } from "../../engine/types";

export interface PlantPickerProps {
  crops: CropsById;
  mode: FarmMode;
  selectedCropId: CropId | null;
  onSelect: (cropId: CropId) => void;
}

const PICKER_PIXEL_SIZE = 3;

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
  gap: "10px",
  marginBottom: "28px",
};

const tileStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
  padding: "12px 8px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  background: "var(--color-bg)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const tileSelectedStyle: React.CSSProperties = {
  ...tileStyle,
  border: "2px solid var(--color-olive)",
  background: "var(--color-pale-green)",
};

const spriteBoxStyle: React.CSSProperties = {
  height: "48px",
  display: "flex",
  alignItems: "flex-end",
};

const nameStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--color-text)",
  textAlign: "center",
};

/**
 * Grid of plantable crops (real crops only — fallow is never a planting
 * choice), filtered to whichever ones fit the field's farm/garden mode.
 */
export default function PlantPicker({ crops, mode, selectedCropId, onSelect }: PlantPickerProps) {
  const plantableCropIds = Object.entries(crops)
    .filter(([, crop]) => crop.planting_window != null && crop.fits.includes(mode))
    .map(([id]) => id);

  return (
    <div style={gridStyle}>
      {plantableCropIds.map((cropId) => {
        const crop = crops[cropId];
        const sprite = getCropSpriteSet(cropId).full;
        const isSelected = cropId === selectedCropId;
        return (
          <button key={cropId} style={isSelected ? tileSelectedStyle : tileStyle} onClick={() => onSelect(cropId)} aria-pressed={isSelected}>
            <span style={spriteBoxStyle}>
              <PixelSprite grid={sprite.rows} pixelSize={PICKER_PIXEL_SIZE} />
            </span>
            <span style={nameStyle}>{crop.display_name}</span>
          </button>
        );
      })}
    </div>
  );
}
