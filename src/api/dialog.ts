/**
 * フロント（webview）側の確認ダイアログの入口（マイルストーン7）。
 *
 * Tauri 版は `@tauri-apps/plugin-dialog` の `ask()` を使っていた。Deno Desktop への移行では、
 * webview の標準 `confirm()` を Tauri 互換シグネチャで包んだ shim（`deno-app/frontend/dialog.ts`）
 * を使う。境界をまたぐ import はこの 1 ファイルに局所化する。
 *
 * 注: `open`（フォルダ選択 picker）は Deno Desktop canary にネイティブ picker が無いため未対応。
 */

export { type AskOptions, ask, type ConfirmFn } from "../../deno-app/frontend/dialog.ts";
