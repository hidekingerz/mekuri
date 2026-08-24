import { useCallback, useState } from "react";
import { rangeBetween, toggleInSet } from "../utils/selection";

export function useFileSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const toggle = useCallback((path: string) => {
    setSelected((prev) => toggleInSet(prev, path));
    setAnchor(path);
  }, []);

  const selectRange = useCallback(
    (order: string[], target: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of rangeBetween(order, anchor, target)) next.add(p);
        return next;
      });
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

  return { selected, toggle, selectRange, selectOnly, clear };
}
