/**
 * webview（フロント）側に置く Tauri 互換 `invoke` shim（マイルストーン3）。
 *
 * Tauri 版フロント（`src/api/*.ts`）は `@tauri-apps/api/core` の
 * `invoke(command, args)` で Rust コマンドを呼んでいた。Deno Desktop では、
 * メイン側で `win.bind("invoke", handler)` に登録したブリッジ（`desktop/bridge.ts`）
 * が webview から `bindings.invoke(command, args)` として呼べるようになる。
 *
 * この shim はその webview 側 API（`globalThis.bindings.invoke`）を Tauri の
 * `invoke` と同じシグネチャで包む。`backend/` を一切 import しないブラウザセーフな
 * コードなので、`src/api/*.ts` の import 先をこれへ差し替えれば Vite ビルドを
 * 壊さずにバックエンドへ橋渡しできる。
 */

/** Tauri の `InvokeArgs` 相当（コマンド引数オブジェクト）。 */
export type InvokeArgs = Record<string, unknown>;

/** Deno Desktop が webview グローバルへ注入する bindings オブジェクトの最小型。 */
export interface DesktopBindings {
  invoke(command: string, args?: InvokeArgs): Promise<unknown>;
}

/** webview グローバルから bindings を解決する関数（テストで差し替え可能）。 */
export type BindingsResolver = () => DesktopBindings;

/** 既定の解決: `globalThis.bindings`（Deno Desktop が注入）を返す。 */
const defaultResolver: BindingsResolver = () => {
  const bindings = (globalThis as { bindings?: DesktopBindings }).bindings;
  if (!bindings || typeof bindings.invoke !== "function") {
    throw new Error(
      "Deno Desktop bindings.invoke is not available (run inside `deno desktop`)",
    );
  }
  return bindings;
};

/**
 * Tauri 互換の `invoke`。`command` と引数オブジェクトをメインプロセスの
 * invoke ブリッジへ転送し、結果（JSON 値）を `T` として返す。
 *
 * 第3引数 `resolver` はテスト用で、`src/api/*.ts` は Tauri と同じ2引数で呼べる。
 */
export async function invoke<T = unknown>(
  command: string,
  args?: InvokeArgs,
  resolver: BindingsResolver = defaultResolver,
): Promise<T> {
  return await resolver().invoke(command, args) as T;
}
