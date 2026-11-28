import { useCallback, useState } from "react";
import { rangeBetween, retainInSet, toggleInSet } from "../utils/selection";

export function useFileSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const toggle = useCallback((path: string) => {
    setSelected((prev) => toggleInSet(prev, path));
    setAnchor(path);
  }, []);

  const selectRange = useCallback(
    (order: string[], target: string) => {
      // Finder と同じく、起点から target までの範囲で選択を置き換える（縮めることもできる）
      setSelected(new Set(rangeBetween(order, anchor, target)));
      setAnchor((prev) => prev ?? target);
    },
    [anchor],
  );

  const selectOnly = useCallback((path: string) => {
    setSelected(new Set([path]));
    setAnchor(path);
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  /** paths に無いものを選択から外す（一覧から消えたファイルを残さない）。起点が消えたら起点も忘れる。 */
  const retain = useCallback((paths: string[]) => {
    setSelected((prev) => retainInSet(prev, paths));
    setAnchor((prev) => (prev !== null && !paths.includes(prev) ? null : prev));
  }, []);

  return { selected, toggle, selectRange, selectOnly, clear, retain };
}
