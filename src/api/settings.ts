import { load } from "@tauri-apps/plugin-store";

const STORE_NAME = "settings.json";

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

async function getStore() {
  return load(STORE_NAME, {
    defaults: {
      windowSettings: DEFAULT_MAIN_SETTINGS,
      viewerSettings: DEFAULT_VIEWER_SETTINGS,
    },
    autoSave: true,
  });
}

export async function getWindowSettings(): Promise<MainWindowSettings> {
  const store = await getStore();
  const settings = await store.get<MainWindowSettings>("windowSettings");
  return settings ?? DEFAULT_MAIN_SETTINGS;
}

export async function saveWindowSettings(settings: Partial<MainWindowSettings>): Promise<void> {
  const store = await getStore();
  const current = (await store.get<MainWindowSettings>("windowSettings")) ?? DEFAULT_MAIN_SETTINGS;
  await store.set("windowSettings", { ...current, ...settings });
}

export async function getViewerSettings(): Promise<ViewerWindowSettings> {
  const store = await getStore();
  const settings = await store.get<ViewerWindowSettings>("viewerSettings");
  return settings ?? DEFAULT_VIEWER_SETTINGS;
}

export async function saveViewerSettings(settings: Partial<ViewerWindowSettings>): Promise<void> {
  const store = await getStore();
  const current =
    (await store.get<ViewerWindowSettings>("viewerSettings")) ?? DEFAULT_VIEWER_SETTINGS;
  await store.set("viewerSettings", { ...current, ...settings });
}
