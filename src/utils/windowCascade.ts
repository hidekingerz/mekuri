/** 画面の中でウィンドウを置ける範囲（論理ピクセル）。 */
export type ScreenArea = { x: number; y: number; width: number; height: number };

/** ウィンドウを 1 枚ごとにずらす量（タイトルバー 1 本ぶん）。 */
export const CASCADE_STEP = 28;

/**
 * count 枚のウィンドウを、右下へ少しずつずらして重ねたときの左上の位置。
 * 重なり全体を画面の中央に置き、画面からはみ出す枚数になったら最初の位置へ戻る。
 * 縦か横の余裕が無いときは、余裕のある向きにだけずらす。
 */
export function cascadePositions(
  count: number,
  screen: ScreenArea,
  size: { width: number; height: number },
): { x: number; y: number }[] {
  const roomX = Math.max(0, screen.width - size.width);
  const roomY = Math.max(0, screen.height - size.height);
  const stepsX = Math.floor(roomX / CASCADE_STEP);
  const stepsY = Math.floor(roomY / CASCADE_STEP);
  const steps = stepsX > 0 && stepsY > 0 ? Math.min(stepsX, stepsY) : Math.max(stepsX, stepsY);
  const used = Math.min(Math.max(0, count - 1), steps);
  const startX = screen.x + Math.round((roomX - Math.min(used, stepsX) * CASCADE_STEP) / 2);
  const startY = screen.y + Math.round((roomY - Math.min(used, stepsY) * CASCADE_STEP) / 2);

  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const k = i % (steps + 1);
    return {
      x: startX + Math.min(k, stepsX) * CASCADE_STEP,
      y: startY + Math.min(k, stepsY) * CASCADE_STEP,
    };
  });
}
