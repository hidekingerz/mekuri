/**
 * webview（フロント）側に置く Tauri 互換 `invoke` shim（マイルストーン3 / M7）。
 *
 * Tauri 版フロント（`src/api/*.ts`）は `@tauri-apps/api/core` の
 * `invoke(command, args)` で Rust コマンドを呼んでいた。Deno Desktop では2つの
 * transport を使い分ける:
 *
 * 1. **HTTP transport（既定・data/store/window 系）**: `fetch("/__invoke")` で
 *    `Deno.serve` のエンドポイント（`main.ts`）を叩く。`win.bind("invoke", ...)` は
 *    起動時に framework が表示する窓に届かない（計測で確定＝白画面の真因、
 *    [m7:denidian-http-pivot]）が、HTTP は窓に依存しないため確実に届く。window 系は
 *    「どの窓からの呼びか」が要るため、自窓 label（`windowLabel.ts`）をリクエストに載せ、
 *    main 側が label→窓を解決する。
 * 2. **bindings transport（窓固有の menu 系）**: `globalThis.bindings.invoke`
 *    を呼ぶ。menu は未だ HTTP 化していないため、引き続き `win.bind` 経由で扱う。
 *    event は全窓ブロードキャストで「どの窓からの呼びか」が不要なため HTTP へ移行済み。
 *
 * いずれも `backend/` を一切 import しないブラウザセーフなコードなので、`src/api/*.ts` の
 * import 先をこれへ差し替えれば Vite ビルドを壊さずにバックエンドへ橋渡しできる。
 */

import { currentWindowLabel } from "./windowLabel.ts";

/** Tauri の `InvokeArgs` 相当（コマンド引数オブジェクト）。 */
export type InvokeArgs = Record<string, unknown>;

/** HTTP invoke transport のパス（`main.ts` の `Deno.serve` と一致させる）。 */
const INVOKE_PATH = "/__invoke";

/**
 * 未だ HTTP 化しておらず `bindings.invoke` で扱うコマンド接頭辞（menu のみ）。
 * window/event 系は HTTP へ移行済み（window は自窓 label 付き、event は全窓ブロードキャスト）。
 */
const BINDINGS_SCOPED_PREFIXES = ["menu_"] as const;

/** コマンドが bindings transport 対象（menu）かを判定する。 */
function isBindingsScoped(command: string): boolean {
  return BINDINGS_SCOPED_PREFIXES.some((prefix) => command.startsWith(prefix));
}

/** `fetch` 互換の関数（テストで差し替え可能）。既定は `globalThis.fetch`。 */
export type FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** `/__invoke` レスポンスの形（`desktop/httpInvoke.ts` の `handleInvokeRequest` と一致）。 */
interface InvokeResponseBody {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/**
 * HTTP transport で invoke を実行する。`POST /__invoke` に `{command, args}` を送り、
 * `{ ok, value | error }` を受け取る。非 2xx もしくは `ok=false` は `error` を投げる。
 */
async function invokeViaHttp<T>(
  command: string,
  args: InvokeArgs | undefined,
  fetchFn: FetchFn,
  windowLabel: string,
): Promise<T> {
  const res = await fetchFn(INVOKE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, args: args ?? null, windowLabel }),
  });
  const payload = await res.json() as InvokeResponseBody;
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error ?? `invoke failed: ${command}`);
  }
  return payload.value as T;
}

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

/** 既定の `fetch`: `globalThis.fetch`。 */
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

/** bindings transport（窓固有コマンド）。起動レース吸収のリトライ付き。 */
async function invokeViaBindings<T>(
  command: string,
  args: InvokeArgs | undefined,
  resolver: BindingsResolver,
  delay: Delay,
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

/**
 * Tauri 互換の `invoke`。`command` と引数オブジェクトをメインプロセスへ転送し、
 * 結果（JSON 値）を `T` として返す。
 *
 * data/store/window/event 系コマンドは HTTP transport（`fetch("/__invoke")`）で、未移行の
 * menu 系コマンドは bindings transport（`globalThis.bindings.invoke`）で処理する。
 * HTTP は `win.bind` が表示窓へ届かない白画面問題を回避するため（[m7:denidian-http-pivot]）。
 * window 系は自窓 label（`windowLabel`）を載せ、main 側が label→窓を解決する。
 *
 * テスト用の注入引数（`resolver`/`delay`/`fetchFn`/`windowLabel`）があり、`src/api/*.ts` は
 * Tauri と同じ2引数で呼べる。bindings transport では `No callback bound`（bind 未登録）で
 * reject した場合のみ短い間隔でリトライする（bind は登録されれば外れないため安全に再試行
 * できる）。それ以外のエラーは即座に伝播する。
 */
export async function invoke<T = unknown>(
  command: string,
  args?: InvokeArgs,
  resolver: BindingsResolver = defaultResolver,
  delay: Delay = defaultDelay,
  fetchFn: FetchFn = defaultFetch,
  windowLabel: string = currentWindowLabel(),
): Promise<T> {
  if (isBindingsScoped(command)) {
    return await invokeViaBindings<T>(command, args, resolver, delay);
  }
  return await invokeViaHttp<T>(command, args, fetchFn, windowLabel);
}
