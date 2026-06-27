/**
 * `menu_*` コマンドのディスパッチ（Tauri の `@tauri-apps/api/menu` 相当）の純粋ロジック。
 *
 * Tauri 版ビューワー（`src/ViewerApp.tsx`）は右クリックで `Menu`/`MenuItem`/
 * `PredefinedMenuItem` からネイティブのコンテキストメニューを組み立て `menu.popup()` で
 * 表示し、各 `MenuItem` の `action` コールバックがクリック時に webview 側で実行されていた。
 *
 * Deno Desktop ではコンテキストメニュー表示はメインプロセスの
 * `BrowserWindow.showContextMenu(x, y, items)`（canary 2.9.0）で行う。クリックは
 * メインプロセスへ `contextMenuClick` イベントとして返るため、クリックされた項目 id を
 * webview の click hook（`frontend/menu.ts` の `globalThis.__mekuriMenuClick`）へ配送し、
 * 対応する `action` を webview 側で実行する。配送は `PushHub` の SSE チャネル
 * （`MENU_CLICK_CHANNEL`）で特定窓へ送る（`executeJs` push は framework の採用窓に
 * 届かないため＝白画面と同じ真因、[m8b:pushhub]）。
 *
 * 本ファイルは `ContextMenuWindow`（`Deno.BrowserWindow` のサブセット）を注入する
 * 純粋関数群で、`Deno.BrowserWindow` には依存しない（`main.ts` が実窓を注入する）ため
 * 単体テスト可能。
 */

import type { InvokeArgs } from "../bindings/mod.ts";
import { MENU_CLICK_CHANNEL, type PushMessage } from "./pushHub.ts";

/**
 * webview から `invoke("menu_popup", ...)` で届く各メニュー項目のシリアライズ形。
 * `action` コールバックは転送できないため、id だけを送り、クリック時に id で webview の
 * 登録済み action を引く（`frontend/menu.ts`）。
 */
export type SerializedMenuItem =
  | { type: "item"; id: string; label: string }
  | { type: "separator" };

/**
 * `Deno.BrowserWindow.showContextMenu` が受け取るネイティブメニュー項目の形
 * （canary 2.9.0 の型に一致）。通常項目は `item`、区切り線は `role: "separator"`。
 */
export type NativeMenuItem =
  | { item: { label: string; id?: string; enabled: boolean } }
  | { role: { role: string } };

/**
 * コンテキストメニューを表示できる窓の最小インターフェース。`Deno.BrowserWindow` が
 * 構造的にこれを満たす。`showContextMenu(x, y, items)` でネイティブメニューを表示する。
 */
export interface ContextMenuWindow {
  showContextMenu(x: number, y: number, items: NativeMenuItem[]): unknown;
}

/**
 * シリアライズ済みメニュー項目を `showContextMenu` 用のネイティブ項目へ変換する。
 * 区切り線は `role: "separator"`、通常項目は `item`（id 付き・常に有効）にする。
 */
export function toNativeMenuItems(
  items: readonly SerializedMenuItem[],
): NativeMenuItem[] {
  return items.map((item) => {
    if (item.type === "separator") {
      return { role: { role: "separator" } };
    }
    return { item: { label: item.label, id: item.id, enabled: true } };
  });
}

/**
 * `contextMenuClick` イベントの detail からクリックされた項目 id を取り出す。
 * detail の形は canary で確定情報が乏しいため、文字列（id 直）と `{ id }` の
 * 両形に対応する（どちらでも壊れないようにするためのヘッジ）。取り出せなければ null。
 */
export function extractMenuClickId(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const id = (detail as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}

/**
 * コンテキストメニューのクリック結果を main → webview の push チャネルへ送れる送信器。
 * `PushHub` が構造的にこれを満たす（`main.ts` が実 hub を注入する）。
 */
export interface MenuClickSender {
  sendTo(windowLabel: string, message: PushMessage): void;
}

/**
 * `contextMenuClick` イベントの detail からクリック id を取り出し、対象窓（`windowLabel`）へ
 * `MENU_CLICK_CHANNEL` の push メッセージとして配送する。id を取り出せなければ送らない。
 * 配送した（または無視した）id を返す（テスト・診断用）。
 *
 * webview 側は SSE 購読 shim（`frontend`）でこのチャネルを受け、`globalThis.__mekuriMenuClick`
 * へ渡して対応する action を実行する。`executeJs` push は採用窓に届かないため使わない。
 */
export function deliverMenuClick(
  sender: MenuClickSender,
  windowLabel: string,
  detail: unknown,
): string | null {
  const id = extractMenuClickId(detail);
  if (id !== null) {
    sender.sendTo(windowLabel, { channel: MENU_CLICK_CHANNEL, data: { id } });
  }
  return id;
}

/**
 * `menu_*` コマンドを処理する。現状はコンテキストメニュー表示の `menu_popup` のみ対応。
 * `args` は `{ x, y, items }`（x/y は webview からのカーソル座標、items は
 * `SerializedMenuItem[]`）。`win.showContextMenu` でネイティブメニューを表示する。
 */
export async function handleMenuCommand(
  win: ContextMenuWindow,
  command: string,
  args?: InvokeArgs,
): Promise<unknown> {
  if (command !== "menu_popup") {
    throw new Error(`Unknown menu command: ${command}`);
  }
  const x = args?.x;
  const y = args?.y;
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error("menu_popup: 'x' and 'y' must be numbers");
  }
  const items = args?.items;
  if (!Array.isArray(items)) {
    throw new Error("menu_popup: 'items' must be an array");
  }
  win.showContextMenu(x, y, toNativeMenuItems(items as SerializedMenuItem[]));
  return await null;
}
