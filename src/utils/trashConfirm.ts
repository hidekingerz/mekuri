const PREVIEW_COUNT = 5;

/** ゴミ箱移動の確認ダイアログ本文。複数件はパスを最大 5 件までプレビューする。 */
export function trashConfirmMessage(paths: string[]): string {
  if (paths.length === 1) {
    return `Are you sure you want to move this file to the trash?\n\n${paths[0]}`;
  }
  const preview = paths.slice(0, PREVIEW_COUNT).join("\n");
  const rest = paths.length - PREVIEW_COUNT;
  const suffix = rest > 0 ? `\n…and ${rest} more` : "";
  return `Are you sure you want to move ${paths.length} files to the trash?\n\n${preview}${suffix}`;
}
