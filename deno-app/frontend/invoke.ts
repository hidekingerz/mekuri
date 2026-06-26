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

/**
 * バインディング未登録を示す Deno Desktop のエラー文言。
 *
 * 起動直後、初期ウィンドウは自動で配信元へ navigate されページが読み込まれるが、その時点では
 * main 側の `win.bind("invoke", ...)` がまだ登録されていないことがある（順序保証が無い）。
 * その間に webview が `bindings.invoke(...)` を呼ぶと、proxy 自体は存在するため `globalThis.bindings`
 * は解決できるものの、呼び出しは `No callback bound for: invoke` で reject する（白画面の真因）。
 * この文言を準備未完了のシグナルとして検知し、bind 完了までリトライする。
 */
const BINDING_NOT_READY = "No callback bound";

/** 準備待ちリトライの上限と間隔（最大 ~1s 待つ＝起動レースの吸収に十分）。 */
const READY_RETRY_LIMIT = 50;
const READY_RETRY_DELAY_MS = 20;

/** リトライ間の待機（テストで差し替え可能）。 */
export type Delay = (ms: number) => Promise<void>;

/** 既定の待機: `setTimeout` ベース。 */
const defaultDelay: Delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** エラーが「バインディング未登録（準備未完了）」かを判定する。 */
function isBindingNotReady(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(BINDING_NOT_READY);
}

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
 * 第3引数 `resolver`・第4引数 `delay` はテスト用で、`src/api/*.ts` は Tauri と同じ2引数で呼べる。
 *
 * 起動レース対策として、`No callback bound`（bind 未登録）で reject した場合のみ短い間隔で
 * リトライする（bind は登録されれば二度と外れないため、`No callback bound` の間は安全に再試行
 * できる＝そのコマンドはまだ実行されていない）。それ以外のエラー（backend の実エラーや bindings
 * 不在）は即座に伝播する。
 */
export async function invoke<T = unknown>(
  command: string,
  args?: InvokeArgs,
  resolver: BindingsResolver = defaultResolver,
  delay: Delay = defaultDelay,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= READY_RETRY_LIMIT; attempt++) {
    try {
      return await resolver().invoke(command, args) as T;
    } catch (error) {
      if (!isBindingNotReady(error)) throw error;
      lastError = error;
      if (attempt < READY_RETRY_LIMIT) await delay(READY_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
