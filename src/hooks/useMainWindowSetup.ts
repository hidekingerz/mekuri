import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { wasOpenedViaFile } from "../api/launch";
import { getWindowSettings, saveWindowSettings } from "../api/settings";
import { useWindowResize } from "./useWindowResize";

/**
 * メインウィンドウの起動時処理。保存済みのウィンドウサイズとカラム幅を復元し、
 * Finder のファイルオープン起動でなければウィンドウを表示する。
 * 復元後はリサイズのたびにサイズを保存する。
 */
export function useMainWindowSetup(onTreeColumnWidth: (width: number) => void) {
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const win = getCurrentWindow();
      let openedViaFile = false;
      try {
        openedViaFile = await wasOpenedViaFile();
      } catch (err) {
        console.error("Failed to query launch state:", err);
      }
      try {
        const settings = await getWindowSettings();
        onTreeColumnWidth(settings.treeColumnWidth);
        await win.setSize(new LogicalSize(settings.width, settings.height));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        if (!openedViaFile) {
          await win.show();
        }
        setSettingsLoaded(true);
      }
    }
    loadSettings();
  }, [onTreeColumnWidth]);

  const handleWindowResize = useCallback(async (size: { width: number; height: number }) => {
    await saveWindowSettings(size);
  }, []);
  useWindowResize(handleWindowResize, settingsLoaded);
}
