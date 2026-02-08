import {
  DEFAULT_MAIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  DEFAULT_TREE_COLUMN_WIDTH,
  DEFAULT_VIEWER_HEIGHT,
  DEFAULT_VIEWER_WIDTH,
} from "../utils/constants";
import { getStore } from "./store";

type MainWindowSettings = {
  width: number;
  height: number;
  treeColumnWidth: number;
};

type ViewerWindowSettings = {
  width: number;
  height: number;
};

const DEFAULT_MAIN_SETTINGS: MainWindowSettings = {
  width: DEFAULT_MAIN_WIDTH,
  height: DEFAULT_MAIN_HEIGHT,
  treeColumnWidth: DEFAULT_TREE_COLUMN_WIDTH,
};

const DEFAULT_VIEWER_SETTINGS: ViewerWindowSettings = {
  width: DEFAULT_VIEWER_WIDTH,
  height: DEFAULT_VIEWER_HEIGHT,
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
