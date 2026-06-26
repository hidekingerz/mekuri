/**
 * HTTP transport（`/__invoke`）で届く `window_*` コマンドを、呼び出し元の窓 label から
 * 実窓へ解決して実行する純粋ロジック（Desktop API 非依存）。
 *
 * 背景: 起動時 `src/App.tsx` が呼ぶ `window_set_size`/`window_show`/`window_set_title` は、
 * `win.bind("invoke", ...)` が framework の表示窓へ届かないため bindings transport では
 * 不達（白画面の主因、[m7:denidian-http-pivot]）。HTTP は表示窓へ確実に届くため window 系も
 * HTTP へ移すが、HTTP では「どの窓からの呼びか」が消えるので、frontend が自窓 label を
 * リクエストに載せ（`frontend/windowLabel.ts`）、main 側が label→窓を解決する（`main.ts`）。
 * 本ファイルはその解決＋検証を純粋関数として実装し、単体テスト可能にする。
 */

import { type ControllableWindow, handleWindowCommand } from "./window.ts";
import type { InvokeArgs } from "../bindings/mod.ts";

/** label から実窓を解決する関数。`main.ts` がメイン窓・ビューワー窓の registry を束縛して渡す。 */
export type WindowResolver = (label: string) => ControllableWindow | undefined;

/**
 * `windowLabel` で示された窓に対して `window_*` コマンドを実行する。
 *
 * label が欠落（data/store 系のみを想定したリクエストが誤って window コマンドを送った等）、
 * または該当窓が見つからない（既に閉じられた等）場合はエラーにする。窓が解決できれば
 * `handleWindowCommand` に委譲する（実際のサイズ変更等は注入された実窓が行う）。
 */
export async function handleWindowCommandByLabel(
  resolve: WindowResolver,
  windowLabel: string | undefined,
  command: string,
  args?: InvokeArgs,
): Promise<unknown> {
  if (typeof windowLabel !== "string" || windowLabel.length === 0) {
    throw new Error(`window command '${command}': windowLabel is required`);
  }
  const win = resolve(windowLabel);
  if (!win) {
    throw new Error(
      `window command '${command}': no window for label '${windowLabel}'`,
    );
  }
  return await handleWindowCommand(win, command, args);
}
