import { getStore } from "./store";

const FAVORITES_KEY = "favorites";

export async function getFavorites(): Promise<string[]> {
  const store = await getStore({ [FAVORITES_KEY]: [] });
  const favorites = await store.get<string[]>(FAVORITES_KEY);
  return favorites ?? [];
}

export async function addFavorite(path: string): Promise<void> {
  const store = await getStore({ [FAVORITES_KEY]: [] });
  const favorites = (await store.get<string[]>(FAVORITES_KEY)) ?? [];
  if (!favorites.includes(path)) {
    favorites.push(path);
    await store.set(FAVORITES_KEY, favorites);
  }
}

export async function removeFavorite(path: string): Promise<void> {
  const store = await getStore({ [FAVORITES_KEY]: [] });
  const favorites = (await store.get<string[]>(FAVORITES_KEY)) ?? [];
  const index = favorites.indexOf(path);
  if (index !== -1) {
    favorites.splice(index, 1);
    await store.set(FAVORITES_KEY, favorites);
  }
}
