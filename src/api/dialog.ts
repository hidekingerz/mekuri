/**
 * フロント（webview）側の確認ダイアログの入口（マイルストーン7）。
 *
 * Tauri 版は `@tauri-apps/plugin-dialog` の `ask()` / `open()` を使っていた。Deno Desktop への
 * 移行では、webview の標準 `confirm()` と、メイン側 `open_folder` バインディング（`Deno.Command`
 * で OS 標準のフォルダ選択ダイアログを起動）を Tauri 互換シグネチャで包んだ shim
 * （`deno-app/frontend/dialog.ts`）を使う。境界をまたぐ import はこの 1 ファイルに局所化する。
 */

export {
  type AskOptions,
  ask,
  type ConfirmFn,
  type OpenInvokeFn,
  type OpenOptions,
  open,
} from "../../deno-app/frontend/dialog.ts";
