/**
 * VERIFY ゲート: フロント（`../src`）に `@tauri-apps/*` の import が残っていないか検査する。
 *
 * Deno Desktop 版ではフロントは Tauri ランタイムを持たないため、`@tauri-apps/api` 等を
 * import すると webview で `__TAURI_INTERNALS__` 未定義により実行時クラッシュ（白画面）する。
 * 型チェック（tsc）や vitest（モック）は通ってしまうので、この grep ゲートで静的に弾く。
 * 残っている場合は非ゼロ終了し、該当箇所を表示する。
 */

import { walk } from "@std/fs/walk";

const SRC = new URL("../../src/", import.meta.url).pathname;
// 静的 import / 動的 import() / require() のいずれでも検出する。
const TAURI = /(?:from|import\s*\(|require\s*\()\s*["']@tauri-apps/;

const hits: string[] = [];
for await (
  const entry of walk(SRC, { exts: [".ts", ".tsx"], includeDirs: false })
) {
  const text = await Deno.readTextFile(entry.path);
  text.split("\n").forEach((line, i) => {
    if (TAURI.test(line)) hits.push(`${entry.path}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length > 0) {
  console.error(
    `FAIL: @tauri-apps が src/ に ${hits.length} 件残っています。Deno Desktop の` +
      ` bindings（deno-app の invoke/各 IPC）経由へ移行してください:`,
  );
  for (const h of hits) console.error("  " + h);
  Deno.exit(1);
}

console.log("OK: src/ に @tauri-apps の import はありません。");
