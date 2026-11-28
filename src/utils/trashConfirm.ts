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

/** フォルダをゴミ箱に移すときの確認の見出し。 */
export function folderTrashConfirmTitle(path: string): string {
  const name = path.split("/").pop() || path;
  return `フォルダ「${name}」をゴミ箱に移動しますか?`;
}

/**
 * フォルダの確認の本文。中身ごと移ることを、一覧に出るファイル（アーカイブと PDF）の件数で伝える。
 * 中にお気に入りがあれば、その登録も外すことを添える。
 */
export function folderTrashConfirmLines(fileCount: number, favoriteCount = 0): string[] {
  const lines = [
    fileCount === 0
      ? "フォルダの中にアーカイブや PDF はありません"
      : `中のファイル ${fileCount} 件（サブフォルダを含む）も一緒に移動します`,
  ];
  if (favoriteCount > 0) lines.push(`お気に入り ${favoriteCount} 件の登録も外します`);
  return lines;
}
