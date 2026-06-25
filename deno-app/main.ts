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
 * 4. ビューワー窓を生成する `open_viewer` バインディング（`src/App.tsx` の `handleArchiveSelect`
 *    相当）。同一アーカイブの二重オープンは label レジストリで防止する（ロジックは
 *    `desktop/viewer.ts`、ここは `Deno.BrowserWindow` 管理の注入のみ）。
 *
 * 実行: `deno desktop main.ts`（deno >= 2.9.0 / canary が必要）。
 */

import { serveDir } from "@std/http/file-server";
import { handleInvoke, mainWindowOptions, openViewer } from "./desktop/mod.ts";
import { handleStoreCommand } from "./bindings/mod.ts";
import { DEFAULT_VIEWER_SETTINGS, settingsPath, Store } from "./backend/mod.ts";

/** ビルド済み Vite フロント（リポジトリルートの `dist/`）。M6 のビルドで生成される。 */
const FRONTEND_DIR = new URL("../dist/", import.meta.url).pathname;

// フロント配信。webview はこの Deno.serve のアドレスへ自動遷移する。
const server = Deno.serve((req) =>
  serveDir(req, { fsRoot: FRONTEND_DIR, quiet: true })
);
/** ビューワー窓を遷移させるための配信元 origin。 */
const origin = `http://${server.addr.hostname}:${server.addr.port}`;

// 設定永続化ストア（tauri-plugin-store 相当）。Tauri 版と同じ settings.json パスを
// app config dir 配下に開き、`store_set` ごとに自動保存する。webview からの `store_*`
// コマンドはこの 1 インスタンスへ集約される（M3/M5 の store 系 IPC 配線）。
const store = await Store.load(settingsPath(), { autoSave: true });

// 最初の `new Deno.BrowserWindow()` は自動で開いた初期ウィンドウを採用する。
const win = new Deno.BrowserWindow(mainWindowOptions());

/** `win.bind` ハンドラが返すべき JSON 値型（lib から導出）。 */
type BridgeReturn = Awaited<ReturnType<Parameters<typeof win.bind>[1]>>;

/** invoke ブリッジを窓に登録する（メイン窓・各ビューワー窓とも IPC が必要）。 */
function bindInvoke(target: Deno.BrowserWindow): void {
  target.bind(
    "invoke",
    async (...args) =>
      (await handleInvoke(
        args,
        undefined,
        (command, storeArgs) => handleStoreCommand(store, command, storeArgs),
      )) as BridgeReturn,
  );
}

// IPC ブリッジ: webview の `bindings.invoke(command, args)` を backend へ橋渡しする。
bindInvoke(win);

/** 開いているビューワー窓を label で管理し、同一アーカイブの二重オープンを防ぐ。 */
const viewerWindows = new Map<string, Deno.BrowserWindow>();

// ビューワー窓生成バインディング。webview は `bindings.open_viewer(archivePath)` を呼ぶ。
win.bind("open_viewer", async (...args) => {
  const archivePath = args[0];
  if (typeof archivePath !== "string") {
    throw new Error("open_viewer: archivePath must be a string");
  }
  await openViewer(archivePath, {
    findWindow: (label) => {
      const existing = viewerWindows.get(label);
      if (!existing || existing.isClosed()) {
        viewerWindows.delete(label);
        return undefined;
      }
      return { focus: () => existing.focus() };
    },
    createWindow: (label, options, url) => {
      const viewer = new Deno.BrowserWindow(options);
      bindInvoke(viewer);
      viewer.navigate(`${origin}/${url}`);
      viewer.show();
      viewerWindows.set(label, viewer);
    },
    // 保存済みサイズの読み出し（settings.json）はアプリ層配線（M5）まで既定値を使う。
    loadViewerSettings: () => DEFAULT_VIEWER_SETTINGS,
  });
  return null as BridgeReturn;
});

win.show();
