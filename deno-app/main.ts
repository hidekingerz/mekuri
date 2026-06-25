/// <reference lib="deno.desktop" />
/**
 * Deno Desktop エントリポイント（マイルストーン4）。
 *
 * Tauri 版（`src-tauri/`）の `WebviewWindow` + IPC を `Deno.BrowserWindow` + bindings で置き換える。
 * 本ファイルは Desktop API への配線のみを担い、ロジックは `desktop/`（純粋・テスト可能）に置く。
 *
 * 役割:
 * 1. `Deno.serve` でビルド済みフロント（`dist/`）を配信する。webview は自動でここへ遷移する。
 * 2. メインウィンドウを `Deno.BrowserWindow` で起動する（サイズ/タイトルは `desktop/windowConfig.ts`）。
 * 3. webview→Deno メインの IPC ブリッジを確立する。`bindings.invoke(command, args)` を
 *    `win.bind("invoke", ...)` で受け、`bindings/`（→`backend/`）へディスパッチする。
 *
 * 実行: `deno desktop main.ts`（deno >= 2.9.0 / canary が必要）。
 * ビューワー窓の生成と同一アーカイブ二重オープン防止は別タスク（M4 続き）。
 */

import { serveDir } from "@std/http/file-server";
import { handleInvoke, mainWindowOptions } from "./desktop/mod.ts";

/** ビルド済み Vite フロント（リポジトリルートの `dist/`）。M6 のビルドで生成される。 */
const FRONTEND_DIR = new URL("../dist/", import.meta.url).pathname;

// フロント配信。webview はこの Deno.serve のアドレスへ自動遷移する。
Deno.serve((req) => serveDir(req, { fsRoot: FRONTEND_DIR, quiet: true }));

// 最初の `new Deno.BrowserWindow()` は自動で開いた初期ウィンドウを採用する。
const win = new Deno.BrowserWindow(mainWindowOptions());

/** `win.bind` ハンドラが返すべき JSON 値型（lib から導出）。 */
type BridgeReturn = Awaited<ReturnType<Parameters<typeof win.bind>[1]>>;

// IPC ブリッジ: webview の `bindings.invoke(command, args)` を backend へ橋渡しする。
win.bind(
  "invoke",
  async (...args) => (await handleInvoke(args)) as BridgeReturn,
);

win.show();
