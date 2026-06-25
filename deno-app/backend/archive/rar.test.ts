/**
 * rar.ts のテスト。
 *
 * RAR は書き込み対応の純粋 JS ライブラリが乏しく、テスト用アーカイブの生成が
 * 難しい。元の Tauri 実装（`src-tauri/src/archive/mod.rs`）の RAR テストも
 * 存在しないファイル等のエラーパス中心であるため、ここでも同じ戦略で
 * エラーハンドリングを検証する。
 */

import { assertExists, assertRejects } from "@std/assert";
import {
  analyzeContents,
  extractNestedArchive,
  getImageBase64,
  listImages,
} from "./rar.ts";

Deno.test("listImages: 存在しない RAR はエラー", async () => {
  await assertRejects(
    () => listImages("nonexistent.rar"),
    Error,
    "Failed to open RAR archive",
  );
});

Deno.test("listImages: 存在しない CBR もエラー（拡張子に依存しない）", async () => {
  await assertRejects(() => listImages("nonexistent.cbr"), Error);
});

Deno.test("analyzeContents: 存在しない RAR はエラー", async () => {
  await assertRejects(
    () => analyzeContents("nonexistent.rar"),
    Error,
    "Failed to open RAR archive",
  );
});

Deno.test("getImageBase64: 存在しない RAR はエラー", async () => {
  await assertRejects(
    () => getImageBase64("nonexistent.rar", "image.jpg"),
    Error,
  );
});

Deno.test("extractNestedArchive: 存在しない RAR はエラー", async () => {
  await assertRejects(
    () => extractNestedArchive("nonexistent.rar", "inner.zip"),
    Error,
  );
});

Deno.test("listImages: RAR として不正なデータは読み取りエラー", async () => {
  const tempDir = await Deno.makeTempDir();
  const badPath = `${tempDir}/bad.rar`;
  try {
    await Deno.writeFile(badPath, new Uint8Array([0x00, 0x01, 0x02, 0x03]));
    const err = await assertRejects(() => listImages(badPath), Error);
    // openRar は成功し、エントリ列挙時に読み取りエラーへ変換される。
    assertExists(err.message);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
