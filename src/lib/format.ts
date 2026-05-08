export function formatBytes(b: number): string {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`;
  if (b >= 1_000_000) return `${Math.round(b / 1_000_000)} MB`;
  if (b >= 1_000) return `${Math.round(b / 1_000)} KB`;
  return `${b} B`;
}
