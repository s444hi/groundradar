export function scoreColor(value: number): string {
  if (value >= 80) return "var(--color-sim-good)";
  if (value >= 50) return "var(--color-sim-warning)";
  return "var(--color-sim-risk)";
}
