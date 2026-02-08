import { type RefObject, useCallback, useEffect, useState } from "react";
import { saveWindowSettings } from "../api/settings";
import { FAVORITES_SIDEBAR_WIDTH, MIN_COLUMN_WIDTH } from "../utils/constants";

export function useColumnResize(
  initialWidth: number,
  columnsRef: RefObject<HTMLDivElement | null>,
) {
  const [treeColumnWidth, setTreeColumnWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Sync initial width from settings
  const setWidth = useCallback((width: number) => {
    setTreeColumnWidth(width);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    let currentWidth = treeColumnWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!columnsRef.current) return;
      const columnsRect = columnsRef.current.getBoundingClientRect();
      const newWidth = e.clientX - columnsRect.left - FAVORITES_SIDEBAR_WIDTH;
      const clampedWidth = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(newWidth, columnsRect.width - FAVORITES_SIDEBAR_WIDTH - MIN_COLUMN_WIDTH),
      );
      currentWidth = clampedWidth;
      setTreeColumnWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      saveWindowSettings({ treeColumnWidth: currentWidth });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, treeColumnWidth, columnsRef]);

  return { treeColumnWidth, setWidth, isResizing, startResize };
}
