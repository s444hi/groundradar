export interface PixelSpriteProps {
  grid: string[];
  pixelSize: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * Renders a string[] grid as a pixel-art SVG: '#' cells fill with `color`,
 * 'o' cells fill with `secondaryColor`, anything else is transparent.
 * Self-contained (sized to the grid) so it can be dropped anywhere,
 * including later reused by DinoRunner.
 */
export default function PixelSprite({
  grid,
  pixelSize,
  color = "var(--color-pixel)",
  secondaryColor = "var(--color-pixel-light)",
}: PixelSpriteProps) {
  const height = grid.length;
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <svg width={width * pixelSize} height={height * pixelSize} style={{ display: "block" }}>
      {grid.flatMap((row, rowIndex) =>
        [...row].map((char, colIndex) => {
          if (char !== "#" && char !== "o") return null;
          return (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * pixelSize}
              y={rowIndex * pixelSize}
              width={pixelSize}
              height={pixelSize}
              fill={char === "#" ? color : secondaryColor}
              shapeRendering="crispEdges"
            />
          );
        }),
      )}
    </svg>
  );
}
