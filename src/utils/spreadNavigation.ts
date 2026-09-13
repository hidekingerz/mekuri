/** ビューワーのページ移動操作。入力 (キー・クリック・ホイール) を移動に変換する純粋関数。 */

export type NavigationAction = "next" | "prev" | "first" | "last";

/** キー入力を読み方向を考慮したページ移動に変換する。対象外のキーは null。 */
export function navigationForKey(key: string, isRtl: boolean): NavigationAction | null {
  switch (key) {
    case " ":
      return "next";
    case "ArrowLeft":
      return isRtl ? "next" : "prev";
    case "ArrowRight":
      return isRtl ? "prev" : "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/** ページ領域の左右どちらをクリックしたかを読み方向に沿った移動に変換する。 */
export function navigationForClick(isLeftHalf: boolean, isRtl: boolean): "next" | "prev" {
  if (isLeftHalf) return isRtl ? "next" : "prev";
  return isRtl ? "prev" : "next";
}

/** ホイールの縦方向の移動量をページ移動に変換する。0 なら null。 */
export function navigationForWheel(deltaY: number): "next" | "prev" | null {
  if (deltaY > 0) return "next";
  if (deltaY < 0) return "prev";
  return null;
}

/** プログレスバー上のクリック位置を 0..1 の比率にする。RTL では右端が 0。 */
export function progressRatio(
  clientX: number,
  rect: { left: number; right: number; width: number },
  isRtl: boolean,
): number {
  return isRtl ? (rect.right - clientX) / rect.width : (clientX - rect.left) / rect.width;
}

/** 0..1 の比率を最も近いグループ index に変換する (範囲外は端にクランプ)。 */
export function groupIndexFromRatio(ratio: number, groupCount: number): number {
  if (groupCount <= 0) return 0;
  const index = Math.round(ratio * (groupCount - 1));
  return Math.max(0, Math.min(index, groupCount - 1));
}

/** index の要素を取り除いたあとに表示すべき隣接要素。後ろを優先し、無ければ前。単独や範囲外なら null。 */
export function siblingAfterRemoval<T>(items: T[], index: number): T | null {
  if (index < 0 || index >= items.length) return null;
  return items[index + 1] ?? items[index - 1] ?? null;
}
