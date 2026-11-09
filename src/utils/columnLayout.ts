/**
 * ツリー列の幅を、ファイル列に最小幅が残る範囲に収める。
 * containerWidth が 0 以下（未計測）のときは width をそのまま返す。
 */
export function clampTreeColumnWidth(
  width: number,
  containerWidth: number,
  sidebarWidth: number,
  minColumnWidth: number,
): number {
  if (containerWidth <= 0) return Math.max(minColumnWidth, width);
  const max = containerWidth - sidebarWidth - minColumnWidth;
  return Math.max(minColumnWidth, Math.min(width, max));
}
