import { useCallback, useEffect, useState } from "react";
import { getViewerSettings, saveViewerSettings } from "../api/settings";
import { isViewMode, type ReadingDirection, type ViewMode } from "../utils/spreadLayout";

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
      // 知らない値（別の版が保存したものなど）は使わず、既定の見開きのままにする
      if (isViewMode(settings.viewMode)) {
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
