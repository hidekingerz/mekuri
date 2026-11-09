const PREVIEW_COUNT = 5;

/** ゴミ箱移動の確認ダイアログの見出し。 */
export function trashConfirmTitle(count: number): string {
  return count === 1
    ? "ファイルをゴミ箱に移動しますか?"
    : `${count} 件のファイルをゴミ箱に移動しますか?`;
}

/** 確認ダイアログの本文。ファイル名を最大 5 件まで並べ、残りは件数で示す。 */
export function trashConfirmLines(paths: string[]): string[] {
  const names = paths.slice(0, PREVIEW_COUNT).map((p) => p.split("/").pop() || p);
  const rest = paths.length - PREVIEW_COUNT;
  return rest > 0 ? [...names, `…ほか ${rest} 件`] : names;
}
