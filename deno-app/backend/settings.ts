/**
 * settings.json ストアの高レベルラッパ（Tauri 版フロントの
 * `src/api/favorites.ts` / `src/api/settings.ts` 相当）。
 *
 * お気に入り（パスの配列）と、メイン窓・ビューワー窓の表示設定
 * （ウィンドウサイズ・カラム幅・表示モード・読み方向）を読み書きする。
 *
 * `backend/` は Deno Desktop API に依存しない純粋ロジックとして実装するため、
 * 永続化先は `Store`（backend/store.ts）インスタンスを引数で受け取る。Tauri 版が
 * `load("settings.json", { defaults, autoSave: true })` で開いていたのと同様、
 * 呼び出し側（アプリ層）が `autoSave: true` で開いた `Store` を渡せば、`set` の
 * たびにファイルへ自動保存される。
 */

import type { Store } from "./store.ts";

/** 見開き／単ページの表示モード（`src/utils/spreadLayout.ts` 相当）。 */
export type ViewMode = "spread" | "single";

/** 読み方向（右綴じ／左綴じ、`src/utils/spreadLayout.ts` 相当）。 */
export type ReadingDirection = "rtl" | "ltr";

/** メイン窓の設定（`src/api/settings.ts` の `MainWindowSettings` 相当）。 */
export interface MainWindowSettings {
  width: number;
  height: number;
  treeColumnWidth: number;
}

/** ビューワー窓の設定（`src/api/settings.ts` の `ViewerWindowSettings` 相当）。 */
export interface ViewerWindowSettings {
  width: number;
  height: number;
  viewMode: ViewMode;
  readingDirection?: ReadingDirection;
}

/** ストアのキー名（Tauri 版フロントと一致させる）。 */
export const FAVORITES_KEY = "favorites";
export const WINDOW_SETTINGS_KEY = "windowSettings";
export const VIEWER_SETTINGS_KEY = "viewerSettings";

/** 既定値（`src/utils/constants.ts` 相当）。 */
export const DEFAULT_MAIN_SETTINGS: MainWindowSettings = {
  width: 1000,
  height: 700,
  treeColumnWidth: 300,
};

export const DEFAULT_VIEWER_SETTINGS: ViewerWindowSettings = {
  width: 1200,
  height: 900,
  viewMode: "spread",
};

/** お気に入りパスの一覧を返す。未設定なら空配列。 */
export function getFavorites(store: Store): string[] {
  return store.get<string[]>(FAVORITES_KEY) ?? [];
}

/** お気に入りにパスを追加する（重複は無視）。 */
export async function addFavorite(store: Store, path: string): Promise<void> {
  const favorites = getFavorites(store);
  if (!favorites.includes(path)) {
    favorites.push(path);
    await store.set(FAVORITES_KEY, favorites);
  }
}

/** お気に入りからパスを削除する（存在しなければ何もしない）。 */
export async function removeFavorite(
  store: Store,
  path: string,
): Promise<void> {
  const favorites = getFavorites(store);
  const index = favorites.indexOf(path);
  if (index !== -1) {
    favorites.splice(index, 1);
    await store.set(FAVORITES_KEY, favorites);
  }
}

/** メイン窓の設定を返す。未設定なら既定値。 */
export function getWindowSettings(store: Store): MainWindowSettings {
  return store.get<MainWindowSettings>(WINDOW_SETTINGS_KEY) ??
    DEFAULT_MAIN_SETTINGS;
}

/** メイン窓の設定を部分更新して保存する。 */
export async function saveWindowSettings(
  store: Store,
  settings: Partial<MainWindowSettings>,
): Promise<void> {
  const current = getWindowSettings(store);
  await store.set(WINDOW_SETTINGS_KEY, { ...current, ...settings });
}

/** ビューワー窓の設定を返す。未設定なら既定値。 */
export function getViewerSettings(store: Store): ViewerWindowSettings {
  return store.get<ViewerWindowSettings>(VIEWER_SETTINGS_KEY) ??
    DEFAULT_VIEWER_SETTINGS;
}

/** ビューワー窓の設定を部分更新して保存する。 */
export async function saveViewerSettings(
  store: Store,
  settings: Partial<ViewerWindowSettings>,
): Promise<void> {
  const current = getViewerSettings(store);
  await store.set(VIEWER_SETTINGS_KEY, { ...current, ...settings });
}
