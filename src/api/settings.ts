import {
  DEFAULT_MAIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  DEFAULT_TREE_COLUMN_WIDTH,
  DEFAULT_VIEWER_HEIGHT,
  DEFAULT_VIEWER_WIDTH,
} from "../utils/constants";
import { DEFAULT_FILE_SORT, type FileSort, isFileSort } from "../utils/fileSort";
import type { ReadingDirection, ViewMode } from "../utils/spreadLayout";
import { getStore } from "./store";

type MainWindowSettings = {
  width: number;
  height: number;
  treeColumnWidth: number;
};

type ViewerWindowSettings = {
  width: number;
  height: number;
  viewMode: ViewMode;
  readingDirection?: ReadingDirection;
};

const DEFAULT_MAIN_SETTINGS: MainWindowSettings = {
  width: DEFAULT_MAIN_WIDTH,
  height: DEFAULT_MAIN_HEIGHT,
  treeColumnWidth: DEFAULT_TREE_COLUMN_WIDTH,
};

const DEFAULT_VIEWER_SETTINGS: ViewerWindowSettings = {
  width: DEFAULT_VIEWER_WIDTH,
  height: DEFAULT_VIEWER_HEIGHT,
  viewMode: "spread",
};

const STORE_DEFAULTS = {
  windowSettings: DEFAULT_MAIN_SETTINGS,
  viewerSettings: DEFAULT_VIEWER_SETTINGS,
};

export async function getWindowSettings(): Promise<MainWindowSettings> {
  const store = await getStore(STORE_DEFAULTS);
  const settings = await store.get<MainWindowSettings>("windowSettings");
  return settings ?? DEFAULT_MAIN_SETTINGS;
}

export async function saveWindowSettings(settings: Partial<MainWindowSettings>): Promise<void> {
  const store = await getStore(STORE_DEFAULTS);
  const current = (await store.get<MainWindowSettings>("windowSettings")) ?? DEFAULT_MAIN_SETTINGS;
  await store.set("windowSettings", { ...current, ...settings });
}

export async function getViewerSettings(): Promise<ViewerWindowSettings> {
  const store = await getStore(STORE_DEFAULTS);
  const settings = await store.get<ViewerWindowSettings>("viewerSettings");
  return settings ?? DEFAULT_VIEWER_SETTINGS;
}

export async function saveViewerSettings(settings: Partial<ViewerWindowSettings>): Promise<void> {
  const store = await getStore(STORE_DEFAULTS);
  const current =
    (await store.get<ViewerWindowSettings>("viewerSettings")) ?? DEFAULT_VIEWER_SETTINGS;
  await store.set("viewerSettings", { ...current, ...settings });
}

/** メインウィンドウのファイル一覧の並び順。ビューワーの前後のファイルの順にも使う。 */
export async function getFileSort(): Promise<FileSort> {
  const store = await getStore(STORE_DEFAULTS);
  const saved = await store.get<unknown>("fileSort");
  // 知らない値（別の版が保存したものなど）は使わず、名前の昇順にする
  return isFileSort(saved) ? saved : DEFAULT_FILE_SORT;
}

export async function saveFileSort(sort: FileSort): Promise<void> {
  const store = await getStore(STORE_DEFAULTS);
  await store.set("fileSort", sort);
}
