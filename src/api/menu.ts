/**
 * フロント（webview）側のコンテキストメニューの入口（マイルストーン7）。
 *
 * Tauri 版は `@tauri-apps/api/menu` の `Menu`/`MenuItem`/`PredefinedMenuItem` でネイティブ
 * メニューを組み立て表示していた。Deno Desktop への移行では、webview 側で
 * `invoke("menu_popup")` とメインからのクリック配送（`globalThis.__mekuriMenuClick`）を
 * Tauri 互換シグネチャで包んだ shim（`deno-app/frontend/menu.ts`）を使う。
 * 境界をまたぐ import はこの 1 ファイルに局所化する。
 */

export type { MenuPosition } from "../../deno-app/frontend/menu.ts";
export { Menu, MenuItem, PredefinedMenuItem } from "../../deno-app/frontend/menu.ts";
