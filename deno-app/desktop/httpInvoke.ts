/**
 * webview → Deno メインの invoke を **HTTP transport** で処理する純粋ロジック。
 *
 * 背景（白画面の真因・[m7:denidian-http-pivot]）: Deno Desktop の `win.bind("invoke", ...)`
 * は、起動時に framework が自動オープン・自動遷移させる「表示窓」に届かないことが計測で
 * 確定した（`new Deno.BrowserWindow()` で得た `win` と表示窓が別オブジェクト）。リファレンス
 * 実装 denidian は `win.bind` を一切使わず、webview から `Deno.serve` のエンドポイントへ
 * `fetch` する HTTP transport で backend を叩いている。HTTP は窓に依存しないため、この
 * 採用バグを完全に回避できる。
 *
 * ここでは `POST /__invoke`（body=`{command, args}`）を受けて invoke ディスパッチャへ委譲し、
 * 結果を JSON で返す純粋関数を実装する。`Deno.serve` への配線（どの dispatch を渡すか）は
 * `main.ts` が担い、本ファイルは Desktop API 非依存に保つ（単体テスト可能）。
 */

import type { InvokeArgs } from "../bindings/mod.ts";

/** `/__invoke` のリクエストパス。`main.ts` の `Deno.serve` と `frontend/invoke.ts` で共有する。 */
export const INVOKE_PATH = "/__invoke";

/**
 * invoke を処理するディスパッチ関数。`main.ts` が `handleInvoke` を束縛して渡す。
 * 窓非依存の data/store 系に加え、`windowLabel`（呼び出し元の窓を示す label）を受け取れば
 * window 系コマンドも扱える（`main.ts` が label→窓を解決して `handleWindowCommand` へ委譲する）。
 */
export type InvokeDispatch = (
  command: string,
  args: InvokeArgs | undefined,
  windowLabel: string | undefined,
) => Promise<unknown>;

/**
 * `POST /__invoke`（body=`{command, args?, windowLabel?}`）を処理し JSON レスポンスを返す。
 * `windowLabel` は window 系コマンドの呼び出し元の窓を示す（data/store 系では省略可）。
 *
 * 成功時は `{ ok: true, value }`（200）、リクエスト不正は `{ ok: false, error }`（400）、
 * dispatch 中のエラーは `{ ok: false, error }`（500）。`frontend/invoke.ts` はこの形を読み、
 * `ok` が false（または非 2xx）なら `error` を投げ、成功なら `value` を返す。
 */
export async function handleInvokeRequest(
  req: Request,
  dispatch: InvokeDispatch,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "invoke request: body must be valid JSON" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null) {
    return Response.json(
      { ok: false, error: "invoke request: body must be an object" },
      { status: 400 },
    );
  }
  const command = (body as Record<string, unknown>).command;
  if (typeof command !== "string") {
    return Response.json(
      { ok: false, error: "invoke request: command must be a string" },
      { status: 400 },
    );
  }
  const rawArgs = (body as Record<string, unknown>).args;
  if (
    rawArgs !== undefined && rawArgs !== null && typeof rawArgs !== "object"
  ) {
    return Response.json(
      { ok: false, error: "invoke request: args must be an object" },
      { status: 400 },
    );
  }
  const args = (rawArgs ?? undefined) as InvokeArgs | undefined;
  const rawLabel = (body as Record<string, unknown>).windowLabel;
  if (
    rawLabel !== undefined && rawLabel !== null && typeof rawLabel !== "string"
  ) {
    return Response.json(
      { ok: false, error: "invoke request: windowLabel must be a string" },
      { status: 400 },
    );
  }
  const windowLabel = (rawLabel ?? undefined) as string | undefined;
  try {
    const value = await dispatch(command, args, windowLabel);
    return Response.json({ ok: true, value: value ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
