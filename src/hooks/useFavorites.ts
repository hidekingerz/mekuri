import { load } from "@tauri-apps/plugin-store";

const STORE_NAME = "settings.json";
const FAVORITES_KEY = "favorites";

async function getStore() {
  return load(STORE_NAME, {
    defaults: { [FAVORITES_KEY]: [] },
    autoSave: true,
  });
}

export async function getFavorites(): Promise<string[]> {
  const store = await getStore();
  const favorites = await store.get<string[]>(FAVORITES_KEY);
  return favorites ?? [];
}

export async function addFavorite(path: string): Promise<void> {
  const store = await getStore();
  const favorites = (await store.get<string[]>(FAVORITES_KEY)) ?? [];
  if (!favorites.includes(path)) {
    favorites.push(path);
    await store.set(FAVORITES_KEY, favorites);
  }
}

export async function removeFavorite(path: string): Promise<void> {
  const store = await getStore();
  const favorites = (await store.get<string[]>(FAVORITES_KEY)) ?? [];
  const index = favorites.indexOf(path);
  if (index !== -1) {
    favorites.splice(index, 1);
    await store.set(FAVORITES_KEY, favorites);
  }
}
