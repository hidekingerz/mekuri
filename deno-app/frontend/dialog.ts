/**
 * webview（フロント）側に置く Tauri 互換のダイアログ shim（`@tauri-apps/plugin-dialog` 相当）。
 *
 * Tauri 版フロントは `ask(message, { title, kind })` で確認ダイアログ（boolean を返す）を、
 * `open({ directory })` でフォルダ選択（path | null を返す）を使っていた。Deno Desktop の
 * webview には標準の `confirm()` があるため、`ask` はそれを呼ぶ shim で等価に実装する
 * （ゴミ箱移動前の確認ゲートという機能はそのまま保たれる。title/kind のダイアログ装飾のみ失われる）。
 *
 * `open`（フォルダ選択 picker）は webview/Deno Desktop にネイティブ picker op が無いため、
 * メイン側の `open_folder` バインディング（`Deno.Command` で OS 標準ダイアログを起動）を
 * IPC（`invoke`）経由で呼ぶ shim として実装する。選択パス（`string`）またはキャンセル時
 * `null` を返し、Tauri 版 `open({ directory: true })` と等価。
 *
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/` の
 * `@tauri-apps/plugin-dialog` import をこの shim へ差し替えれば Vite ビルドを壊さない。
 */

import { invoke } from "./invoke.ts";

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

/** Tauri の `open` のオプション相当（本 shim はフォルダ選択＝`directory: true` のみ対応）。 */
export interface OpenOptions {
  directory?: boolean;
}

/** テスト差し替え用の invoke 関数型（`open_folder` バインディングを呼ぶ）。 */
export type OpenInvokeFn = (command: string) => Promise<string | null>;

/**
 * Tauri の `@tauri-apps/plugin-dialog` の `open` 相当（フォルダ選択）。メイン側の
 * `open_folder` バインディングを IPC で呼び、選択されたフォルダのパスを返す。
 * ユーザーがキャンセルした場合は `null` に解決する。
 * テスト容易化のため第2引数で invoke 実装を注入可能（既定は `frontend/invoke.ts` の `invoke`）。
 */
export function open(
  _options?: OpenOptions,
  invokeFn: OpenInvokeFn = (command) => invoke<string | null>(command),
): Promise<string | null> {
  return invokeFn("open_folder");
}
