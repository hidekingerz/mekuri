import { useCallback, useEffect, useMemo, useState } from "react";
import { existingDirs } from "../api/directory";
import { getFavorites } from "../api/favorites";
import { onFileChanged } from "../api/fileEvents";
import { getRecentFolders, onRecentFoldersChanged } from "../api/recentFolders";
import {
  type RecentFolder,
  type ResolvedRecentFolder,
  resolveRecentFolders,
} from "../utils/recentFolders";

type Loaded = { list: RecentFolder[]; favorites: string[]; existing: Set<string> };

const EMPTY: Loaded = { list: [], favorites: [], existing: new Set() };

/**
 * 最近開いたフォルダ（画面に出す形）。ビューワで開いたとき・ファイルが動いたとき・
 * お気に入りが変わったとき（favoritesRefresh）に読み直す。
 */
export function useRecentFolders(
  favoritesRefresh: number,
  currentFolder: string | null,
): ResolvedRecentFolder[] {
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);

  const load = useCallback(async () => {
    try {
      const [list, favorites] = await Promise.all([getRecentFolders(), getFavorites()]);
      const existing = new Set(await existingDirs(list.map((entry) => entry.folder)));
      setLoaded({ list, favorites, existing });
    } catch (err) {
      console.error("Failed to load recent folders:", err);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: favoritesRefresh is intentionally used to force re-fetch
  useEffect(() => {
    void load();
  }, [load, favoritesRefresh]);

  useEffect(() => {
    const unlisteners = [onRecentFoldersChanged(load), onFileChanged(load)];
    return () => {
      for (const unlisten of unlisteners) unlisten.then((fn) => fn());
    };
  }, [load]);

  return useMemo(
    () =>
      resolveRecentFolders(loaded.list, loaded.favorites, currentFolder, (folder) =>
        loaded.existing.has(folder),
      ),
    [loaded, currentFolder],
  );
}
