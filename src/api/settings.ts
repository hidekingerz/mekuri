import { getStore } from "./store";

interface MainWindowSettings {
  width: number;
  height: number;
  treeColumnWidth: number;
}

interface ViewerWindowSettings {
  width: number;
  height: number;
}

const DEFAULT_MAIN_SETTINGS: MainWindowSettings = {
  width: 1000,
  height: 700,
  treeColumnWidth: 300,
};

const DEFAULT_VIEWER_SETTINGS: ViewerWindowSettings = {
  width: 1200,
  height: 900,
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
