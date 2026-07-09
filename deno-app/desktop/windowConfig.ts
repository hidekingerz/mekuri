/**
 * メインウィンドウの `Deno.BrowserWindow` 構築オプションを導出する純粋ロジック。
 *
 * Tauri 版（`src-tauri/tauri.conf.json` の `main` 窓 + `src/App.tsx` の設定復元）では
 * 既定 1000x700・title "mekuri"・resizable で起動し、保存済みウィンドウサイズがあれば
 * それを復元していた。ここではその導出を Desktop API 非依存の純粋関数として実装する。
 *
 * 注意: canary の `BrowserWindowOptions` には `minWidth`/`minHeight`/`visible` が無いため、
 * Tauri 版の最小サイズ（600x400）制約はここでは表現できない（未対応＝別途）。
 */

import { DEFAULT_MAIN_SETTINGS } from "../backend/mod.ts";

/** メインウィンドウのタイトル（`src/App.tsx` のデフォルトと一致）。 */
export const MAIN_WINDOW_TITLE = "mekuri";

/**
 * `Deno.BrowserWindow` に渡すオプション（利用する部分集合・Desktop lib 非依存）。
 * `main.ts` で `new Deno.BrowserWindow(mainWindowOptions(...))` に渡す。
 */
export interface MainWindowOptions {
  title: string;
  width: number;
  height: number;
  resizable: boolean;
}

/**
 * 保存済みウィンドウ設定（あれば width/height）から、メイン窓のオプションを導出する。
 * 未指定の項目は `DEFAULT_MAIN_SETTINGS`（1000x700）にフォールバックする。
 */
export function mainWindowOptions(
  settings?: { width?: number; height?: number },
): MainWindowOptions {
  return {
    title: MAIN_WINDOW_TITLE,
    width: settings?.width ?? DEFAULT_MAIN_SETTINGS.width,
    height: settings?.height ?? DEFAULT_MAIN_SETTINGS.height,
    resizable: true,
  };
}
