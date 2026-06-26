/**
 * `window_*` コマンドのディスパッチ（Tauri の `@tauri-apps/api/window` 相当）の純粋ロジック。
 *
 * Tauri 版フロント（`src/App.tsx` / `src/ViewerApp.tsx` / `src/hooks/*`）は
 * `getCurrentWindow()` で得たウィンドウの `setSize` / `getSize` / `setTitle` / `show` /
 * `onResized` を使っていた。Deno Desktop ではこれらを webview→メインの IPC（`bindings.invoke`）
 * 経由の `window_*` コマンドへ置き換える。本ファイルは `ControllableWindow`（`Deno.BrowserWindow`
 * のサブセット）を受け取りコマンドを実行する純粋関数で、`Deno.BrowserWindow` には依存しない
 * （`main.ts` が実窓を注入する）ため単体テスト可能。
 */

import type { InvokeArgs } from "../bindings/mod.ts";

/**
 * `window_*` コマンドが操作する OS ウィンドウの最小インターフェース。
 * `Deno.BrowserWindow` が構造的にこれを満たす（`main.ts` がそのまま渡す）。
 */
export interface ControllableWindow {
  setSize(width: number, height: number): void;
  getSize(): [number, number];
  setTitle(title: string): void;
  show(): void;
  close(): void;
}

function requireNumber(args: InvokeArgs | undefined, key: string): number {
  const value = args?.[key];
  if (typeof value !== "number") {
    throw new Error(`window command: '${key}' must be a number`);
  }
  return value;
}

function requireString(args: InvokeArgs | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value !== "string") {
    throw new Error(`window command: '${key}' must be a string`);
  }
  return value;
}

/**
 * `window_*` コマンドを実行する。`main.ts` の `bindInvoke` から、各ウィンドウ自身を
 * `win` として束縛した状態で呼ばれる（webview の `getCurrentWindow()` がその窓を指す）。
 * 戻り値は JSON 値。`window_get_size` のみ `{ width, height }` を返し、他は `null`。
 */
export async function handleWindowCommand(
  win: ControllableWindow,
  command: string,
  args?: InvokeArgs,
): Promise<unknown> {
  switch (command) {
    case "window_set_size": {
      win.setSize(requireNumber(args, "width"), requireNumber(args, "height"));
      return await null;
    }
    case "window_get_size": {
      const [width, height] = win.getSize();
      return await { width, height };
    }
    case "window_set_title": {
      win.setTitle(requireString(args, "title"));
      return await null;
    }
    case "window_show": {
      win.show();
      return await null;
    }
    case "window_close": {
      win.close();
      return await null;
    }
    default:
      throw new Error(`Unknown window command: ${command}`);
  }
}
