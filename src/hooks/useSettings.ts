import { load } from "@tauri-apps/plugin-store";

const STORE_NAME = "settings.json";

interface WindowSettings {
  width: number;
  height: number;
  treeColumnWidth: number;
}

const DEFAULT_SETTINGS: WindowSettings = {
  width: 1000,
  height: 700,
  treeColumnWidth: 300,
};

async function getStore() {
  return load(STORE_NAME, {
    defaults: { windowSettings: DEFAULT_SETTINGS },
    autoSave: true,
  });
}

export async function getWindowSettings(): Promise<WindowSettings> {
  const store = await getStore();
  const settings = await store.get<WindowSettings>("windowSettings");
  return settings ?? DEFAULT_SETTINGS;
}

export async function saveWindowSettings(settings: Partial<WindowSettings>): Promise<void> {
  const store = await getStore();
  const current = (await store.get<WindowSettings>("windowSettings")) ?? DEFAULT_SETTINGS;
  await store.set("windowSettings", { ...current, ...settings });
}
