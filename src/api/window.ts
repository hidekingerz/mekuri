/**
 * フロント（webview）側のウィンドウ操作の入口（マイルストーン7）。
 *
 * Tauri 版は `@tauri-apps/api/window` の `getCurrentWindow()` / `LogicalSize` を使っていた。
 * Deno Desktop への移行では、webview 側で `invoke("window_*")` を Tauri 互換シグネチャで包んだ
 * shim（`deno-app/frontend/window.ts`）を使う。境界をまたぐ import はこの 1 ファイルに局所化する。
 */

export type {
  PhysicalSize,
  ResizedEvent,
  ResizeHandler,
  UnlistenFn,
} from "../../deno-app/frontend/window.ts";
export {
  AppWindow,
  getCurrentWindow,
  LogicalSize,
} from "../../deno-app/frontend/window.ts";
