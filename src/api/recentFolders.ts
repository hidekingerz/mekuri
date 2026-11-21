import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { parseRecentFolders, type RecentFolder, recordOpen } from "../utils/recentFolders";
import { getStore } from "./store";

const RECENT_FOLDERS_KEY = "recentFolders";
/** 履歴が変わったことをメインウィンドウへ知らせるアプリ内イベント */
const RECENT_FOLDERS_CHANGED = "recent-folders-changed";

export async function getRecentFolders(): Promise<RecentFolder[]> {
  const store = await getStore({ [RECENT_FOLDERS_KEY]: [] });
  return parseRecentFolders(await store.get(RECENT_FOLDERS_KEY));
}

/** ビューワで filePath を開いたことを記録する。 */
export async function recordRecentFolder(filePath: string): Promise<void> {
  const store = await getStore({ [RECENT_FOLDERS_KEY]: [] });
  const list = parseRecentFolders(await store.get(RECENT_FOLDERS_KEY));
  await store.set(RECENT_FOLDERS_KEY, recordOpen(list, filePath, Date.now()));
  await emit(RECENT_FOLDERS_CHANGED);
}

export function onRecentFoldersChanged(listener: () => void): Promise<UnlistenFn> {
  return listen(RECENT_FOLDERS_CHANGED, listener);
}
