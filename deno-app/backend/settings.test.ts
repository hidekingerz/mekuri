import { assertEquals } from "@std/assert";
import { Store } from "./store.ts";
import {
  addFavorite,
  DEFAULT_MAIN_SETTINGS,
  DEFAULT_VIEWER_SETTINGS,
  getFavorites,
  getViewerSettings,
  getWindowSettings,
  removeFavorite,
  saveViewerSettings,
  saveWindowSettings,
} from "./settings.ts";

const STORE_DEFAULTS = {
  favorites: [],
  windowSettings: DEFAULT_MAIN_SETTINGS,
  viewerSettings: DEFAULT_VIEWER_SETTINGS,
};

async function withStore(
  fn: (store: Store, path: string) => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/settings.json`;
  try {
    const store = await Store.load(path, {
      defaults: STORE_DEFAULTS,
      autoSave: true,
    });
    await fn(store, path);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("getFavorites returns empty array by default", async () => {
  await withStore((store) => {
    assertEquals(getFavorites(store), []);
    return Promise.resolve();
  });
});

Deno.test("addFavorite appends a path", async () => {
  await withStore(async (store) => {
    await addFavorite(store, "/a.zip");
    assertEquals(getFavorites(store), ["/a.zip"]);
  });
});

Deno.test("addFavorite ignores duplicates", async () => {
  await withStore(async (store) => {
    await addFavorite(store, "/a.zip");
    await addFavorite(store, "/a.zip");
    assertEquals(getFavorites(store), ["/a.zip"]);
  });
});

Deno.test("removeFavorite removes an existing path", async () => {
  await withStore(async (store) => {
    await addFavorite(store, "/a.zip");
    await addFavorite(store, "/b.zip");
    await removeFavorite(store, "/a.zip");
    assertEquals(getFavorites(store), ["/b.zip"]);
  });
});

Deno.test("removeFavorite is a no-op for a missing path", async () => {
  await withStore(async (store) => {
    await addFavorite(store, "/a.zip");
    await removeFavorite(store, "/missing.zip");
    assertEquals(getFavorites(store), ["/a.zip"]);
  });
});

Deno.test("favorites persist to file via autoSave", async () => {
  await withStore(async (store, path) => {
    await addFavorite(store, "/a.zip");
    const reopened = await Store.load(path, { defaults: STORE_DEFAULTS });
    assertEquals(getFavorites(reopened), ["/a.zip"]);
  });
});

Deno.test("getWindowSettings returns defaults", async () => {
  await withStore((store) => {
    assertEquals(getWindowSettings(store), DEFAULT_MAIN_SETTINGS);
    return Promise.resolve();
  });
});

Deno.test("saveWindowSettings merges partial updates", async () => {
  await withStore(async (store) => {
    await saveWindowSettings(store, { width: 1280 });
    assertEquals(getWindowSettings(store), {
      ...DEFAULT_MAIN_SETTINGS,
      width: 1280,
    });
  });
});

Deno.test("getViewerSettings returns defaults", async () => {
  await withStore((store) => {
    assertEquals(getViewerSettings(store), DEFAULT_VIEWER_SETTINGS);
    return Promise.resolve();
  });
});

Deno.test("saveViewerSettings merges partial updates including readingDirection", async () => {
  await withStore(async (store) => {
    await saveViewerSettings(store, {
      viewMode: "single",
      readingDirection: "ltr",
    });
    assertEquals(getViewerSettings(store), {
      ...DEFAULT_VIEWER_SETTINGS,
      viewMode: "single",
      readingDirection: "ltr",
    });
  });
});

Deno.test("settings persist to file via autoSave", async () => {
  await withStore(async (store, path) => {
    await saveViewerSettings(store, { viewMode: "single" });
    const reopened = await Store.load(path, { defaults: STORE_DEFAULTS });
    assertEquals(getViewerSettings(reopened).viewMode, "single");
  });
});
