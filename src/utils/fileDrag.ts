import { FILE_DRAG_MIME } from "./constants";

/**
 * FILE_DRAG_MIME で dataTransfer に載せるパス一覧のエンコード/デコード。
 * 単一パスの生文字列（旧形式・ビューワーからのドラッグ）も受け付ける。
 */
export function encodeDragPaths(paths: string[]): string {
  return JSON.stringify(paths);
}

export function decodeDragPaths(data: string): string[] {
  if (!data) return [];
  if (!data.startsWith("[")) return [data];
  try {
    const parsed: unknown = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

/** ドラッグの出どころ。アプリ内のドラッグは FILE_DRAG_MIME を、Finder などは "Files" を載せる。 */
export function dragSource(types: readonly string[]): "app" | "external" | null {
  if (types.includes(FILE_DRAG_MIME)) return "app";
  if (types.includes("Files")) return "external";
  return null;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function nameKey(names: string[]): string {
  return JSON.stringify(names.map((n) => n.normalize("NFC")).sort());
}

/**
 * ドラッグ用ペーストボードから読んだパスが、いま落とされたファイルのものかを名前で確かめる。
 * 一致すればそのパスを、別のドラッグの残りなど一致しなければ空を返す。
 */
export function matchDroppedPaths(droppedNames: string[], pasteboardPaths: string[]): string[] {
  if (droppedNames.length === 0) return [];
  if (nameKey(droppedNames) !== nameKey(pasteboardPaths.map(baseName))) return [];
  return pasteboardPaths;
}
