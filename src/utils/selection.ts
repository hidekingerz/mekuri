export function toggleInSet<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}

/** anchor から target までの範囲（両端含む）を order の並び順で返す。anchor が無効なら target のみ。 */
export function rangeBetween<T>(order: T[], anchor: T | null, target: T): T[] {
  const anchorIndex = anchor === null ? -1 : order.indexOf(anchor);
  const targetIndex = order.indexOf(target);
  if (anchorIndex === -1 || targetIndex === -1) return [target];
  const [start, end] =
    anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  return order.slice(start, end + 1);
}
