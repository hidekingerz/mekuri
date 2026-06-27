/**
 * webview（フロント）側に置く Tauri 互換 `invoke` shim（マイルストーン3 / M7 / M8b）。
 *
 * Tauri 版フロント（`src/api/*.ts`）は `@tauri-apps/api/core` の `invoke(command, args)` で
 * Rust コマンドを呼んでいた。Deno Desktop ではこれを **HTTP transport**（`fetch("/__invoke")`）
 * で `Deno.serve` のエンドポイント（`main.ts`）へ送る。
 *
 * かつては窓固有コマンド（window/event/menu）を `globalThis.bindings.invoke`（`win.bind`）で
 * 扱う bindings transport も併用していたが、`win.bind` は起動時に framework が表示する窓へ
 * 届かない（計測で確定＝白画面の真因、[m7:denidian-http-pivot]）。HTTP は窓に依存せず確実に
 * 届くため、window→event→menu の順に全コマンドを HTTP へ移行し、bindings transport は撤去した。
 * window/menu 系は「どの窓からの呼びか」が要るため、自窓 label（`windowLabel.ts`）をリクエストに
 * 載せ、main 側が label→窓を解決する。event 系は全窓ブロードキャストのため label 不要。
 *
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/api/*.ts` の import 先を
 * これへ差し替えれば Vite ビルドを壊さずにバックエンドへ橋渡しできる。
 */

import { currentWindowLabel } from "./windowLabel.ts";

/** Tauri の `InvokeArgs` 相当（コマンド引数オブジェクト）。 */
export type InvokeArgs = Record<string, unknown>;

/** HTTP invoke transport のパス（`main.ts` の `Deno.serve` と一致させる）。 */
const INVOKE_PATH = "/__invoke";

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

/** 既定の `fetch`: `globalThis.fetch`。 */
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

/**
 * Tauri 互換の `invoke`。`command` と引数オブジェクトをメインプロセスへ転送し、結果（JSON 値）を
 * `T` として返す。`POST /__invoke` に `{command, args, windowLabel}` を送り、`{ ok, value | error }`
 * を受け取る。非 2xx もしくは `ok=false` は `error` を投げる。
 *
 * window/menu 系コマンドは `windowLabel`（自窓 label）で呼び出し元の窓を示し、main 側が label→窓
 * を解決する。テスト用の注入引数（`fetchFn`/`windowLabel`）があり、`src/api/*.ts` は Tauri と同じ
 * 2 引数で呼べる。
 */
export async function invoke<T = unknown>(
  command: string,
  args?: InvokeArgs,
  fetchFn: FetchFn = defaultFetch,
  windowLabel: string = currentWindowLabel(),
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
