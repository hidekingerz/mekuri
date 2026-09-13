import { useCallback, useEffect, useState } from "react";
import { getViewerSettings, saveViewerSettings } from "../api/settings";
import type { ReadingDirection, ViewMode } from "../utils/spreadLayout";

/**
 * ビューワーの表示モードと読み方向。マウント時に保存値を復元し、変更時に永続化する。
 * @param defaultReadingDirection 保存値が無いときの読み方向
 */
export function useViewerSettings(defaultReadingDirection: ReadingDirection) {
  const [viewMode, setViewModeState] = useState<ViewMode>("spread");
  const [readingDirection, setReadingDirection] =
    useState<ReadingDirection>(defaultReadingDirection);

  useEffect(() => {
    getViewerSettings().then((settings) => {
      if (settings.viewMode) {
        setViewModeState(settings.viewMode);
      }
      if (settings.readingDirection) {
        setReadingDirection(settings.readingDirection);
      }
    });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    saveViewerSettings({ viewMode: mode });
  }, []);

  const toggleReadingDirection = useCallback(() => {
    setReadingDirection((prev) => {
      const next: ReadingDirection = prev === "rtl" ? "ltr" : "rtl";
      saveViewerSettings({ readingDirection: next });
      return next;
    });
  }, []);

  return { viewMode, readingDirection, setViewMode, toggleReadingDirection };
}
