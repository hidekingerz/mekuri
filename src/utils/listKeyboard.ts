/**
 * リストで ↑↓ / Home / End を押したときの移動先 index。
 * current が -1（未選択）なら先頭へ。扱わないキーや空のリストは null。
 */
export function moveListIndex(count: number, current: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : Math.min(count - 1, current + 1);
    case "ArrowUp":
      return current < 0 ? 0 : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
