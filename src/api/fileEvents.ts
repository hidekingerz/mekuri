import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

/** ウィンドウをまたいでファイルの移動・削除を通知するアプリ内イベント */
const FILE_MOVED = "file-moved";
const FILE_TRASHED = "file-trashed";

export function emitFileMoved(): Promise<void> {
  return emit(FILE_MOVED);
}

export function emitFileTrashed(): Promise<void> {
  return emit(FILE_TRASHED);
}

/** ファイルが移動または削除されたときに listener を呼ぶ。戻り値で購読を解除する。 */
export async function onFileChanged(listener: () => void): Promise<UnlistenFn> {
  const unlisteners = await Promise.all([
    listen(FILE_MOVED, listener),
    listen(FILE_TRASHED, listener),
  ]);
  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}
