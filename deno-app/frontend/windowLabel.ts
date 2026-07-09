/**
 * webview（フロント）側で「自分がどの窓か」を示す label を算出する（M7 / window 系統の
 * HTTP transport 化）。
 *
 * window 系コマンド（`window_set_size` 等）を HTTP（`/__invoke`）で送る際、main 側が
 * 「どの窓からの呼びか」を特定できるよう、リクエストに窓 label を載せる。label は webview の
 * URL から決定できる:
 *  - ビューワー窓は `viewer.html?archive=<path>` で開かれる → label は `viewer-<hash(path)>`。
 *  - メイン窓は `index.html`（archive クエリ無し）→ label は {@link MAIN_WINDOW_LABEL}。
 *
 * label は main 側のビューワー窓 registry のキー（`desktop/viewer.ts` の `viewerLabel`＝
 * `viewer-${hashCode(archivePath)}`）と一致しなければならない。そのため {@link hashCode} は
 * `desktop/viewer.ts` の同名関数と**同一アルゴリズム**を保つこと（frontend を browser-safe に
 * 保つため import せず複製している。値の一致は `windowLabel.test.ts` で固定）。
 */

/** メイン窓の label（`main.ts` の registry と一致させる）。 */
export const MAIN_WINDOW_LABEL = "main";

/**
 * `desktop/viewer.ts` の `hashCode` 相当（決定的ハッシュ）。値は必ず一致させること。
 */
export function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/** label 算出に必要な location の最小形（`globalThis.location` のサブセット）。 */
export interface WindowLocation {
  search: string;
}

/**
 * webview の location から自窓の label を算出する。`archive` クエリがあればビューワー窓
 * （`viewer-<hash(archive)>`）、無ければメイン窓（{@link MAIN_WINDOW_LABEL}）。
 */
export function windowLabelFromLocation(loc: WindowLocation): string {
  const archive = new URLSearchParams(loc.search).get("archive");
  return archive !== null ? `viewer-${hashCode(archive)}` : MAIN_WINDOW_LABEL;
}

/**
 * 実行中の webview の自窓 label を返す。`globalThis.location` が無い環境（Deno test 等）では
 * メイン窓扱い（{@link MAIN_WINDOW_LABEL}）。
 */
export function currentWindowLabel(): string {
  const loc = (globalThis as { location?: { search?: string } }).location;
  return windowLabelFromLocation({ search: loc?.search ?? "" });
}
