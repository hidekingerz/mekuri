/**
 * webview（フロント）側に置く Tauri plugin-store 互換 Store shim（マイルストーン3/5）。
 *
 * Tauri 版フロント（`src/api/store.ts`）は `@tauri-apps/plugin-store` の
 * `load(name, { defaults, autoSave })` でストアを開き、`store.get(key)` /
 * `store.set(key, value)` で永続化していた（`favorites.ts`/`settings.ts` が依存）。
 *
 * Deno Desktop ではメイン側で `backend/store.ts` の `Store` を 1 つ開き、webview からの
 * get/set 要求を `win.bind("invoke", ...)` 経由で `bindings/store.ts` の
 * `handleStoreCommand` へ振り分ける。この shim はその IPC（`invoke("store_get"/"store_set")`）
 * を plugin-store と同じ `get`/`set` シグネチャで包む。`backend/` を一切 import しない
 * ブラウザセーフなコードなので、`src/api/store.ts` の import 先をこれへ差し替えれば
 * Vite ビルドを壊さずにバックエンドの Store へ橋渡しできる（`frontend/invoke.ts` と同パターン）。
 *
 * `defaults` / `autoSave` はアプリ層（`main.ts`）が実 `Store.load(settingsPath(), ...)` を
 * 開く際に適用するため、この shim では受け取るだけで使わない（plugin-store と同じ呼び出し形を保つ）。
 */

import { invoke } from "./invoke.ts";

/** store コマンドを転送する関数（テストで差し替え可能）。既定は webview の `invoke`。 */
export type StoreInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

/** plugin-store の `load(name, options)` 互換オプション（アプリ層で適用するため未使用）。 */
export interface StoreLoadOptions {
  defaults?: Record<string, unknown>;
  autoSave?: boolean;
}

const defaultInvoke: StoreInvoke = (command, args) => invoke(command, args);

/**
 * plugin-store の `Store` 互換ラッパ。`get`/`set` を `invoke("store_*", { key, value })`
 * 経由でメイン側の単一 `Store` へ橋渡しする。`store_get` は未設定キーで `null` を返す
 * （`handleStoreCommand` 側の仕様）ので、frontend は `?? default` で吸収できる。
 */
export class WebviewStore {
  readonly #invoke: StoreInvoke;

  constructor(invokeFn: StoreInvoke = defaultInvoke) {
    this.#invoke = invokeFn;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return await this.#invoke("store_get", { key }) as T | null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.#invoke("store_set", { key, value });
  }
}

/**
 * plugin-store の `load()` 互換エントリ。`name`/`options` は実 Store をアプリ層が開く際に
 * 使うため、この shim では受け取るだけで `WebviewStore` を返す。
 */
export function load(
  _name: string,
  _options?: StoreLoadOptions,
): Promise<WebviewStore> {
  return Promise.resolve(new WebviewStore());
}
