/**
 * rar.ts のテスト。
 *
 * RAR は書き込み対応の純粋 JS ライブラリが乏しく、テスト用アーカイブの生成が
 * 難しい。元の Tauri 実装（`src-tauri/src/archive/mod.rs`）の RAR テストも
 * 存在しないファイル等のエラーパス中心であるため、ここでも同じ戦略で
 * エラーハンドリングを検証する。
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import {
  analyzeContents,
  clearRarCache,
  extractNestedArchive,
  type ExtractorFactory,
  getDecodedImages,
  getImageBase64,
  listImages,
  withRarLock,
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

// --- デコード済み画像キャッシュ & 直列化（実 RAR 不要・モック extractor で検証） ---

/** extract({files: 述語}) を模した最小の extractor。述語に一致するエントリのみ yield する。 */
function fakeExtractor(
  entries: Array<{ name: string; directory?: boolean; bytes?: Uint8Array }>,
): unknown {
  return {
    extract(
      { files }: {
        files?: (h: { name: string; flags: { directory: boolean } }) => boolean;
      } = {},
    ) {
      return {
        files: (function* () {
          for (const e of entries) {
            const header = {
              name: e.name,
              flags: { directory: !!e.directory },
            };
            if (files && !files(header)) continue;
            yield { fileHeader: header, extraction: e.bytes };
          }
        })(),
      };
    },
  };
}

Deno.test("getDecodedImages は全画像を1回展開し path 別にキャッシュする", async () => {
  clearRarCache();
  let calls = 0;
  const factory = ((_p: string) => {
    calls++;
    return Promise.resolve(fakeExtractor([
      { name: "p1.jpg", bytes: new Uint8Array([1]) },
      { name: "readme.txt", bytes: new Uint8Array([9]) }, // 画像でない→除外
      { name: "p2.png", bytes: new Uint8Array([2]) },
      { name: "sub/", directory: true }, // ディレクトリ→除外
      { name: "__MACOSX/x.jpg", bytes: new Uint8Array([3]) }, // 除外
    ]));
  }) as unknown as ExtractorFactory;

  const a = await getDecodedImages("/a.rar", factory);
  const b = await getDecodedImages("/a.rar", factory);
  assertEquals(calls, 1); // 2 回目はキャッシュ
  assertStrictEquals(a, b);
  assertEquals([...a.keys()].sort(), ["p1.jpg", "p2.png"]); // 画像のみ
  assertEquals(a.get("p1.jpg"), new Uint8Array([1]));
  clearRarCache();
});

Deno.test("getDecodedImages は MAX_DECODED を超えると古い書庫を退避する", async () => {
  clearRarCache();
  let calls = 0;
  const factory = ((_p: string) => {
    calls++;
    return Promise.resolve(
      fakeExtractor([{ name: "p.jpg", bytes: new Uint8Array([1]) }]),
    );
  }) as unknown as ExtractorFactory;
  await getDecodedImages("/a.rar", factory); // [a]
  await getDecodedImages("/b.rar", factory); // [a,b]
  await getDecodedImages("/c.rar", factory); // [b,c]（a 退避）
  await getDecodedImages("/a.rar", factory); // a 再展開
  assertEquals(calls, 4);
  clearRarCache();
});

Deno.test("withRarLock は RAR 操作を直列化する（並行でも重ならない）", async () => {
  let active = 0;
  let maxActive = 0;
  const op = () =>
    withRarLock(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
  await Promise.all([op(), op(), op()]);
  assertEquals(maxActive, 1);
});
