/**
 * webview（フロント）側に置く Tauri 互換のダイアログ shim（`@tauri-apps/plugin-dialog` 相当）。
 *
 * Tauri 版フロントは `ask(message, { title, kind })` で確認ダイアログ（boolean を返す）を、
 * `open({ directory })` でフォルダ選択（path | null を返す）を使っていた。Deno Desktop の
 * webview には標準の `confirm()` があるため、`ask` はそれを呼ぶ shim で等価に実装する
 * （ゴミ箱移動前の確認ゲートという機能はそのまま保たれる。title/kind のダイアログ装飾のみ失われる）。
 *
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/` の
 * `@tauri-apps/plugin-dialog` import をこの shim へ差し替えれば Vite ビルドを壊さない。
 *
 * 注: `open`（フォルダ選択 picker）は Deno Desktop canary にネイティブの picker op が無いため
 * 未対応（ここでは提供しない）。フォルダ選択の移行は別途ネイティブ picker の実装が要る。
 */

/** Tauri の `ask` のオプション相当（装飾用。本 shim では未使用）。 */
export interface AskOptions {
  title?: string;
  kind?: "info" | "warning" | "error";
}

/** テスト差し替え用の confirm 関数型。 */
export type ConfirmFn = (message: string) => boolean;

/** 既定の confirm。webview の標準 `globalThis.confirm` を使う。 */
function defaultConfirm(message: string): boolean {
  const confirmImpl = (globalThis as { confirm?: ConfirmFn }).confirm;
  if (typeof confirmImpl !== "function") {
    throw new Error("dialog ask: confirm is not available in this environment");
  }
  return confirmImpl(message);
}

/**
 * Tauri の `@tauri-apps/plugin-dialog` の `ask` 相当。確認ダイアログを表示し、
 * ユーザーが許可したら `true`、キャンセルしたら `false` に解決する。
 * `options`（title/kind）は webview の `confirm` では表現できないため受け取るだけで未使用。
 * テスト容易化のため第3引数で `confirm` 実装を注入可能（既定は `globalThis.confirm`）。
 */
export function ask(
  message: string,
  _options?: AskOptions,
  confirmFn: ConfirmFn = defaultConfirm,
): Promise<boolean> {
  return Promise.resolve(confirmFn(message));
}
