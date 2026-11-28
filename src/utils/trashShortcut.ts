type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean };

/**
 * ゴミ箱移動のショートカットか。OS のファイル管理に合わせる。
 * Delete（Mac では fn+Delete）はどの OS でも受け付け、Cmd+Backspace は Finder と同じく macOS でだけ受け付ける。
 * Backspace 単独と Ctrl+Backspace では発火させない。
 */
export function isTrashShortcut(e: KeyLike, mac: boolean): boolean {
  if (e.key === "Delete") return true;
  return mac && e.key === "Backspace" && e.metaKey;
}

/** WebView のユーザーエージェントが macOS のものか。 */
export function isMacUserAgent(userAgent: string): boolean {
  return userAgent.includes("Macintosh");
}
