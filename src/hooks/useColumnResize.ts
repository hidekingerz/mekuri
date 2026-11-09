import { type RefObject, useCallback, useEffect, useState } from "react";
import { saveWindowSettings } from "../api/settings";
import { clampTreeColumnWidth } from "../utils/columnLayout";
import { FAVORITES_SIDEBAR_WIDTH, MIN_COLUMN_WIDTH } from "../utils/constants";

export function useColumnResize(
  initialWidth: number,
  columnsRef: RefObject<HTMLDivElement | null>,
) {
  // 利用者が選んだ幅（保存値）。表示時にだけウィンドウ幅で制限し、広げ直せば元に戻る
  const [preferredWidth, setTreeColumnWidth] = useState(initialWidth);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const treeColumnWidth = clampTreeColumnWidth(
    preferredWidth,
    containerWidth,
    FAVORITES_SIDEBAR_WIDTH,
    MIN_COLUMN_WIDTH,
  );

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Sync initial width from settings
  const setWidth = useCallback((width: number) => {
    setTreeColumnWidth(width);
  }, []);

  // Track the container so the displayed width keeps the file column visible
  useEffect(() => {
    const el = columnsRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerWidth(el.getBoundingClientRect().width);
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
