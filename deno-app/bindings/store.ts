/**
 * Store 操作のプロセス内ディスパッチ（マイルストーン3/5）。
 *
 * Tauri 版フロント（`src/api/store.ts`/`favorites.ts`/`settings.ts`）は
 * `@tauri-apps/plugin-store` の `load(name, { defaults, autoSave })` でストアを開き、
 * `store.get(key)` / `store.set(key, value)` で永続化していた。Deno Desktop では
 * メイン側で `backend/store.ts` の `Store` を 1 つ開き、webview からの get/set 要求を
 * `win.bind` 経由でこのディスパッチャへ渡す（IPC ブリッジのメイン側受け口）。
 *
 * `invoke.ts` がステートレスに `backend/` の関数を呼ぶのに対し、こちらは開かれた
 * `Store` インスタンスに状態を持たせる点が異なる。`backend/` は Desktop 非依存に保ち、
 * Store の生成（パス解決・ファイル IO）はアプリ層（`main.ts`）が担う。
 */

import type { Store } from "../backend/mod.ts";
import type { InvokeArgs } from "./invoke.ts";

/** 引数オブジェクトから文字列フィールドを必須として取り出す。 */
function requireString(args: InvokeArgs | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid argument: ${key}`);
  }
  return value;
}

/**
 * 開かれた `Store` に対する store コマンドのディスパッチ。
 * 既知のコマンド名（`store_get` / `store_set`）を `Store` のメソッドへ振り分け、
 * 未知のコマンドはエラーにする。`store_get` は未設定キーで `null` を返す
 * （Tauri 版 plugin-store と同じく JSON セーフな値にするため）。
 */
export async function handleStoreCommand(
  store: Store,
  command: string,
  args?: InvokeArgs,
): Promise<unknown> {
  switch (command) {
    case "store_get":
      return store.get(requireString(args, "key")) ?? null;
    case "store_set": {
      const key = requireString(args, "key");
      await store.set(key, args?.value);
      return null;
    }
    default:
      throw new Error(`Unknown store command: ${command}`);
  }
}
