import { type RefObject, useCallback, useEffect, useState } from "react";
import { saveWindowSettings } from "../api/settings";
import { clampTreeColumnWidth } from "../utils/columnLayout";
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

  // Sync initial width from settings (clamped to the current window)
  const setWidth = useCallback(
    (width: number) => {
      const containerWidth = columnsRef.current?.getBoundingClientRect().width ?? 0;
      setTreeColumnWidth(
        clampTreeColumnWidth(width, containerWidth, FAVORITES_SIDEBAR_WIDTH, MIN_COLUMN_WIDTH),
      );
    },
    [columnsRef],
  );

  // Keep the file column visible when the window gets narrower than the saved tree width
  useEffect(() => {
    const el = columnsRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const containerWidth = el.getBoundingClientRect().width;
      setTreeColumnWidth((prev) =>
        clampTreeColumnWidth(prev, containerWidth, FAVORITES_SIDEBAR_WIDTH, MIN_COLUMN_WIDTH),
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [columnsRef]);

  useEffect(() => {
    if (!isResizing) return;

    let currentWidth = treeColumnWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!columnsRef.current) return;
      const columnsRect = columnsRef.current.getBoundingClientRect();
      const newWidth = e.clientX - columnsRect.left - FAVORITES_SIDEBAR_WIDTH;
      const clampedWidth = clampTreeColumnWidth(
        newWidth,
        columnsRect.width,
        FAVORITES_SIDEBAR_WIDTH,
        MIN_COLUMN_WIDTH,
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
