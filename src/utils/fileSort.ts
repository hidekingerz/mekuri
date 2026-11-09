import type { DirectoryEntry } from "../types";

export type SortKey = "name" | "modified" | "size";
export type SortDirection = "asc" | "desc";

export const SORT_KEY_LABELS: Record<SortKey, string> = {
  name: "名前",
  modified: "更新日時",
  size: "サイズ",
};

/**
 * ファイル一覧を並べ替えた新しい配列を返す。
 * 名前順はバックエンドの自然順をそのまま使い、desc では反転する。
 * 更新日時・サイズが無い項目は末尾に置く。
 */
export function sortEntries(
  entries: DirectoryEntry[],
  key: SortKey,
  direction: SortDirection,
): DirectoryEntry[] {
  if (key === "name") {
    return direction === "asc" ? [...entries] : [...entries].reverse();
  }
  const value = (e: DirectoryEntry) => (key === "modified" ? e.modified_ms : e.size) ?? null;
  const sign = direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign;
  });
}
