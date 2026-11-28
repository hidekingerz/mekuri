import type { DirectoryEntry } from "../types";
import { compareEntries, type FileSort } from "./fileSort";
import { fileNameFromPath } from "./windowLabel";

/** ビューワーのページ移動操作。入力 (キー・クリック・ホイール) を移動に変換する純粋関数。 */

export type NavigationAction = "next" | "prev" | "first" | "last";

type KeyLike = {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

/**
 * キー入力を読み方向を考慮したページ移動に変換する。対象外のキーは null。
 * 修飾キー（Shift・Alt・Ctrl・Cmd）を押しながらの入力は、ページ送りとして扱わない。
 */
export function navigationForKey(e: KeyLike, isRtl: boolean): NavigationAction | null {
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return null;
  switch (e.key) {
    case " ":
      return "next";
    case "ArrowLeft":
      return isRtl ? "next" : "prev";
    case "ArrowRight":
      return isRtl ? "prev" : "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/** ページ領域の左右どちらをクリックしたかを読み方向に沿った移動に変換する。 */
export function navigationForClick(isLeftHalf: boolean, isRtl: boolean): "next" | "prev" {
  if (isLeftHalf) return isRtl ? "next" : "prev";
  return isRtl ? "prev" : "next";
}

type WheelLike = {
  deltaY: number;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

/**
 * ホイールの縦方向の移動量をページ移動に変換する。0 なら null。
 * 修飾キーを押しながらの入力（トラックパッドのピンチは Ctrl つきで届く）は、ページ送りとして扱わない。
 */
export function navigationForWheel(e: WheelLike): "next" | "prev" | null {
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.deltaY > 0) return "next";
  if (e.deltaY < 0) return "prev";
  return null;
}

/** プログレスバー上のクリック位置を 0..1 の比率にする。RTL では右端が 0。 */
export function progressRatio(
  clientX: number,
  rect: { left: number; right: number; width: number },
  isRtl: boolean,
): number {
  return isRtl ? (rect.right - clientX) / rect.width : (clientX - rect.left) / rect.width;
}

/** 0..1 の比率を最も近いグループ index に変換する (範囲外は端にクランプ)。 */
export function groupIndexFromRatio(ratio: number, groupCount: number): number {
  if (groupCount <= 0) return 0;
  const index = Math.round(ratio * (groupCount - 1));
  return Math.max(0, Math.min(index, groupCount - 1));
}

/** index の隣の要素 (next は後ろ、prev は前)。端や範囲外なら null。 */
export function adjacentSibling<T>(
  items: T[],
  index: number,
  direction: "next" | "prev",
): T | null {
  if (index < 0 || index >= items.length) return null;
  return items[direction === "next" ? index + 1 : index - 1] ?? null;
}

/** 前後のファイルを決めるのに使う、ファイルの情報。 */
type SiblingEntry = Pick<DirectoryEntry, "path" | "name" | "modified_ms" | "size">;

/**
 * 開いているファイルの情報。一覧にあればそれを、無ければ最後に一覧で見えたときのもの（lastSeen）を使う。
 * 一度も見えていないファイルは、更新日時もサイズも分からないものとして扱う。
 */
export function currentEntry<T extends SiblingEntry>(
  entries: T[],
  path: string,
  lastSeen: SiblingEntry | null,
): SiblingEntry {
  const listed = entries.find((entry) => entry.path === path);
  if (listed) return listed;
  if (lastSeen?.path === path) return lastSeen;
  return { path, name: fileNameFromPath(path), modified_ms: null, size: null };
}

/**
 * current の隣のファイルのパス (next は後ろ、prev は前)。端なら null。entries は sort の順に並べたもの。
 * current が一覧に無いとき（別のウィンドウで消された・動かされた、開く前から無かった）は、
 * その並び順で入るはずの位置の前後を返す。そうしないと、開けないファイルから動けなくなる。
 */
export function siblingPath(
  entries: SiblingEntry[],
  sort: FileSort,
  current: SiblingEntry,
  direction: "next" | "prev",
): string | null {
  const index = entries.findIndex((entry) => entry.path === current.path);
  if (index !== -1) return adjacentSibling(entries, index, direction)?.path ?? null;

  const insertAt = entries.filter((entry) => compareEntries(entry, current, sort) < 0).length;
  return (direction === "next" ? entries[insertAt] : entries[insertAt - 1])?.path ?? null;
}

/** マウスの戻る (button 3) / 進む (button 4) ボタンを兄弟ファイルの移動方向に対応づける。他のボタンは null。 */
export function siblingDirectionForMouseButton(button: number): "next" | "prev" | null {
  if (button === 3) return "prev";
  if (button === 4) return "next";
  return null;
}

/** Alt+↓ を次のファイル、Alt+↑ を前のファイルに対応づける（ファイル一覧の上下と同じ向き）。 */
export function siblingDirectionForKey(e: {
  key: string;
  altKey: boolean;
}): "next" | "prev" | null {
  if (!e.altKey) return null;
  if (e.key === "ArrowDown") return "next";
  if (e.key === "ArrowUp") return "prev";
  return null;
}
