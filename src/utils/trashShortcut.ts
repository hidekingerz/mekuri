type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean };

/**
 * ゴミ箱移動のショートカットか。fn+Delete（前方削除）と Cmd/Ctrl+Backspace（Finder と同じ）だけを受け付け、
 * Backspace 単独では発火させない。
 */
export function isTrashShortcut(e: KeyLike): boolean {
  if (e.key === "Delete") return true;
  return e.key === "Backspace" && (e.metaKey || e.ctrlKey);
}
