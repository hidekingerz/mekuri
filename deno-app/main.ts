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
import {
  errorForwarderScript,
  extractMenuClickId,
  handleEventCommand,
  handleInvoke,
  handleInvokeRequest,
  handleMenuCommand,
  handleWindowCommand,
  handleWindowCommandByLabel,
  INVOKE_PATH,
  mainWindowOptions,
  menuClickScript,
  openViewer,
} from "./desktop/mod.ts";
import { handleStoreCommand } from "./bindings/mod.ts";
import { getViewerSettings, settingsPath, Store } from "./backend/mod.ts";
import { MAIN_WINDOW_LABEL } from "./frontend/windowLabel.ts";

/**
 * ビルド済み Vite フロント。`deno desktop` は main.ts をコンパイルして自己完結アプリへ
 * バンドルし、`--include ../dist` で dist を埋め込む。展開後の仮想 FS はリポジトリルートを
 * 基準に構造を保つ（main.ts は `deno-app/main.ts`、dist は `dist/`）ため、main.ts から見た
 * 配信元は `../dist/`。`--include ../dist` とこのパスは必ずセットで合わせること。
 */
const FRONTEND_DIR = new URL("../dist/", import.meta.url).pathname;

// webview の未捕捉エラーを serve 経由でプロセス stderr（`[web]` 行）へ転送する小スクリプト。
// GUI 無しでも実行時クラッシュ（例: 移行漏れの Tauri API が `__TAURI_INTERNALS__` を触る）を
// 検知でき、smoke test（scripts/smoke.sh）の判定材料になる。表示には影響しない。
// ロジックは desktop/errorForwarder.ts（純粋・テスト可能）に置く。
const ERR_FORWARDER = errorForwarderScript();

// メインウィンドウは「最初の同期処理」として構築する。`deno desktop` は起動時に初期
// ウィンドウを自動で開き、`Deno.serve` のハンドラへ自動遷移させる。最初の
// `new Deno.BrowserWindow()` がその初期ウィンドウを「採用」するが、採用は初回スクリプト
// 評価の同期実行中に構築された場合に成立する。よって `await Store.load()` などのトップ
// レベル await より前に構築し、`bindInvoke` で invoke を登録してから serve/await へ進む。
// これにより、自動遷移したフロントが起動直後に呼ぶ `invoke` が確実にバインド済みウィンドウ
// へ届く（白画面＝起動時 "No callback bound for: invoke" の根本対策）。
const win = new Deno.BrowserWindow(mainWindowOptions());

/** `win.bind` ハンドラが返すべき JSON 値型（lib から導出）。 */
type BridgeReturn = Awaited<ReturnType<Parameters<typeof win.bind>[1]>>;

/** 開いているビューワー窓を label で管理し、同一アーカイブの二重オープンを防ぐ。 */
const viewerWindows = new Map<string, Deno.BrowserWindow>();

/**
 * 設定永続化ストア（tauri-plugin-store 相当）。Tauri 版と同じ settings.json パスを
 * app config dir 配下に開き、`store_set` ごとに自動保存する。webview からの `store_*`
 * コマンドはこの 1 インスタンスへ集約される（M3/M5 の store 系 IPC 配線）。
 *
 * 採用＝bind を auto-navigation より先に確定させるため、ストアの読み込みは遅延する
 * （初回の `store_*`/`open_viewer` 時に解決し、以降は同一インスタンスを共有）。
 */
let storePromise: Promise<Store> | undefined;
function loadStore(): Promise<Store> {
  return (storePromise ??= Store.load(settingsPath(), { autoSave: true }));
}

/**
 * 配信時点で開いている全窓（メイン窓＋未クローズのビューワー窓）を返す。窓間イベント
 * （`@tauri-apps/api/event` の `emit`）のブロードキャスト対象。`handleEventCommand` が
 * 各窓へ `executeJs` で delivery スニペットを実行する。
 */
function liveWindows(): Deno.BrowserWindow[] {
  const all: Deno.BrowserWindow[] = [win];
  for (const viewer of viewerWindows.values()) {
    if (!viewer.isClosed()) all.push(viewer);
  }
  return all;
}

/**
 * 窓 label から実窓を解決する（HTTP transport の `window_*` コマンド用）。webview が自窓 label
 * （`frontend/windowLabel.ts`）をリクエストに載せ、ここでメイン窓／ビューワー窓へ引き当てる。
 * 閉じられたビューワー窓は registry から除いて undefined を返す。
 */
function resolveWindow(label: string): Deno.BrowserWindow | undefined {
  if (label === MAIN_WINDOW_LABEL) return win;
  const viewer = viewerWindows.get(label);
  if (!viewer || viewer.isClosed()) {
    viewerWindows.delete(label);
    return undefined;
  }
  return viewer;
}

/** invoke ブリッジを窓に登録する（メイン窓・各ビューワー窓とも IPC が必要）。 */
function bindInvoke(target: Deno.BrowserWindow): void {
  target.bind(
    "invoke",
    async (...args) =>
      (await handleInvoke(
        args,
        undefined,
        async (command, storeArgs) =>
          handleStoreCommand(await loadStore(), command, storeArgs),
        (command, winArgs) => handleWindowCommand(target, command, winArgs),
        (command, eventArgs) =>
          handleEventCommand(liveWindows, command, eventArgs),
        (command, menuArgs) => handleMenuCommand(target, command, menuArgs),
      )) as BridgeReturn,
  );
  // ネイティブコンテキストメニューのクリックを webview の click hook へ配送する。
  // `showContextMenu` のクリックは `contextMenuClick` イベントとしてメインへ返るため、
  // クリックされた項目 id を `executeJs` で `globalThis.__mekuriMenuClick(id)` に渡し、
  // webview 側（`frontend/menu.ts`）で対応する action を実行させる。
  target.addEventListener("contextMenuClick", (ev) => {
    const id = extractMenuClickId((ev as CustomEvent).detail);
    if (id !== null) target.executeJs(menuClickScript(id));
  });
}

// IPC ブリッジ: webview の `bindings.invoke(command, args)` を backend へ橋渡しする。
// auto-navigation より前に同期で登録し、採用したメイン窓を確実にバインドする。
bindInvoke(win);

// フロント配信。webview はこの Deno.serve のアドレス（127.0.0.1）へ遷移する。
const server = Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/__log") {
    console.error("[web]", url.searchParams.get("m"));
    return new Response("ok");
  }
  // HTTP invoke transport（[m7:denidian-http-pivot]）。webview は data/store/window/event 系
  // コマンドを `fetch("/__invoke")` で叩く。`win.bind` と違い HTTP は表示窓に確実に届くため、
  // 起動時の白画面（`No callback bound for: invoke`）を回避できる。window 系は webview が自窓
  // label をリクエストに載せ、`resolveWindow` が label→窓を解決して `handleWindowCommand` へ
  // 委譲する。event 系は全窓ブロードキャスト（`handleEventCommand(liveWindows, ...)`）なので
  // label 不要。menu は未移行のため引き続き `bindings.invoke`（別 transport）で扱う。
  if (req.method === "POST" && url.pathname === INVOKE_PATH) {
    return await handleInvokeRequest(
      req,
      async (command, args, windowLabel) => {
        // ビューワー窓生成。`open_viewer` は invoke ディスパッチ外（窓生成＝メイン操作）なので
        // ここで直接処理する。HTTP transport なので表示窓から確実に届く（`win.bind` だと届かず
        // ダブルクリックしても窓が開かない）。
        if (command === "open_viewer") {
          const archivePath = (args as Record<string, unknown> | null)
            ?.archivePath;
          if (typeof archivePath !== "string") {
            throw new Error("open_viewer: archivePath must be a string");
          }
          return await doOpenViewer(archivePath);
        }
        return await handleInvoke(
          [command, args],
          undefined,
          async (cmd, storeArgs) =>
            handleStoreCommand(await loadStore(), cmd, storeArgs),
          (cmd, winArgs) =>
            handleWindowCommandByLabel(
              resolveWindow,
              windowLabel,
              cmd,
              winArgs,
            ),
          (cmd, eventArgs) => handleEventCommand(liveWindows, cmd, eventArgs),
        );
      },
    );
  }
  // index.html / viewer.html には ERR_FORWARDER を注入し、メイン窓・ビューワー窓の
  // どちらの webview 実行時エラーも `[web]` 行として stderr へ転送する（smoke の判定材料）。
  if (
    url.pathname === "/" || url.pathname === "/index.html" ||
    url.pathname === "/viewer.html"
  ) {
    const file = url.pathname === "/viewer.html" ? "viewer.html" : "index.html";
    const html = await Deno.readTextFile(FRONTEND_DIR + file);
    return new Response(html.replace("<head>", `<head>${ERR_FORWARDER}`), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return serveDir(req, { fsRoot: FRONTEND_DIR, quiet: true });
});
/**
 * 配信元 origin。webview がバインドされるのは常に 127.0.0.1（Deno.serve が
 * 0.0.0.0 を報告しても実際は 127.0.0.1 にバインドされる）。0.0.0.0 へ navigate すると
 * webview が接続できず "Not Found" になるため、必ず 127.0.0.1 を使う。
 */
const origin = `http://127.0.0.1:${server.addr.port}`;

// ビューワー窓生成。HTTP invoke transport（`/__invoke` の `open_viewer` コマンド）から呼ばれる。
// `win.bind` だと採用窓に届かず窓が開かないため、HTTP 経路に乗せている（[m7:open-viewer-http]）。
async function doOpenViewer(archivePath: string): Promise<null> {
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
    // 保存済みビューワーサイズ（settings.json）を読み出す（Tauri 版 `getViewerSettings` と等価）。
    loadViewerSettings: async () => getViewerSettings(await loadStore()),
  });
  return null;
}

// メイン窓は明示 navigate/show しない。`deno desktop` のリファレンス実装（denidian）に倣い、
// 採用した初期ウィンドウへのフロント表示は **framework の自動遷移**（server readiness 時に
// `Deno.serve` ハンドラへ自動 navigate）に委ねる。明示 `win.navigate(origin)` は採用窓とは別の
// 表示窓を生み（白画面＝表示窓が未 bind＝`No callback bound for: invoke` の原因）得るため外す。
// `origin` はビューワー窓（明示生成＝別窓）の navigate にのみ使う（open_viewer 内で参照）。
