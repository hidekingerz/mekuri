import { load } from "@tauri-apps/plugin-store";

const STORE_NAME = "settings.json";

export function getStore(defaults: Record<string, unknown> = {}) {
  return load(STORE_NAME, { defaults, autoSave: true });
}
