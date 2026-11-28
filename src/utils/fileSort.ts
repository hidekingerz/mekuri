import type { DirectoryEntry } from "../types";
import { compareNatural } from "./naturalOrder";

export type SortKey = "name" | "modified" | "size";
export type SortDirection = "asc" | "desc";

export const SORT_KEY_LABELS: Record<SortKey, string> = {
  name: "名前",
  modified: "更新日時",
  size: "サイズ",
};

/** ファイル一覧の並び順。メインウィンドウで選び、ビューワーの前後のファイルの順にも使う。 */
export type FileSort = { key: SortKey; direction: SortDirection };

export const DEFAULT_FILE_SORT: FileSort = { key: "name", direction: "asc" };

/** 保存されていた値が、いまの版で使える並び順か。 */
export function isFileSort(value: unknown): value is FileSort {
  if (typeof value !== "object" || value === null) return false;
  const { key, direction } = value as Record<string, unknown>;
  return Object.keys(SORT_KEY_LABELS).includes(key as string) && isDirection(direction);
}

function isDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

type Sortable = Pick<DirectoryEntry, "name" | "modified_ms" | "size">;

function sortValue(entry: Sortable, key: Exclude<SortKey, "name">): number | null {
  return (key === "modified" ? entry.modified_ms : entry.size) ?? null;
}

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
  const sign = direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign;
  });
}

/**
 * sortEntries が並べる順での a と b の前後（負なら a が先）。
 * 一覧にもう無いファイルが、その並びのどこに入るはずだったかを求めるのに使う。
 */
export function compareEntries(a: Sortable, b: Sortable, sort: FileSort): number {
  const byName = compareNatural(a.name, b.name);
  if (sort.key === "name") return sort.direction === "asc" ? byName : -byName;

  const va = sortValue(a, sort.key);
  const vb = sortValue(b, sort.key);
  // 値の同じものと、値の無いものどうしは、昇順でも降順でも名前の順のまま（sortEntries は安定ソート）
  if (va === vb) return byName;
  if (va === null) return 1;
  if (vb === null) return -1;
  return sort.direction === "asc" ? va - vb : vb - va;
}
