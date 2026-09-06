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
