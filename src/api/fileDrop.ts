import { invoke } from "@tauri-apps/api/core";
import { FILE_DRAG_MIME } from "../utils/constants";
import { decodeDragPaths, dragSource, matchDroppedPaths } from "../utils/fileDrag";

/**
 * drop イベントで落とされたファイルのパス。アプリ内のドラッグはそのまま、
 * Finder などからのドラッグはドラッグ用ペーストボードから読み、名前が合うときだけ返す。
 * DataTransfer はイベントを抜けると読めなくなるので、await より前に読み切る。
 */
export async function readDroppedPaths(dataTransfer: DataTransfer): Promise<string[]> {
  const source = dragSource(dataTransfer.types);
  if (source === "app") return decodeDragPaths(dataTransfer.getData(FILE_DRAG_MIME));
  if (source !== "external") return [];
  const names = Array.from(dataTransfer.files, (f) => f.name);
  const paths = await invoke<string[]>("read_dragged_paths");
  return matchDroppedPaths(names, paths);
}
