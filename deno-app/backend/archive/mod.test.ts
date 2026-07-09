import { assertRejects } from "@std/assert";
import { analyzeContents, getImageBase64, listImages } from "./mod.ts";

// Tauri 版 `archive/mod.rs` のディスパッチ系テストを移植する。
// 実体の ZIP/RAR 抽出は zip.test.ts / rar.test.ts でカバー済みなので、
// ここでは形式判別（detect_format）とエラーパスの振り分けを検証する。

Deno.test("listImages: 未対応拡張子は Unsupported エラー", async () => {
  await assertRejects(
    () => listImages("test.tar"),
    Error,
    "Unsupported",
  );
});

Deno.test("analyzeContents: 未対応拡張子は Unsupported エラー", async () => {
  await assertRejects(
    () => analyzeContents("test.7z"),
    Error,
    "Unsupported",
  );
});

Deno.test("listImages: 拡張子なしは Unsupported エラー", async () => {
  await assertRejects(
    () => listImages("noext"),
    Error,
    "Unsupported",
  );
});

Deno.test("listImages: 存在しない ZIP はエラー", async () => {
  await assertRejects(() => listImages("nonexistent.zip"), Error);
});

Deno.test("listImages: 存在しない RAR はエラー", async () => {
  await assertRejects(() => listImages("nonexistent.rar"), Error);
});

Deno.test("listImages: .cbz は ZIP へディスパッチ（Unsupported ではない）", async () => {
  const err = await assertRejects(() => listImages("nonexistent.cbz"), Error);
  if (err.message.includes("Unsupported")) {
    throw new Error(`.cbz が ZIP へディスパッチされていない: ${err.message}`);
  }
});

Deno.test("listImages: .cbr は RAR へディスパッチ（Unsupported ではない）", async () => {
  const err = await assertRejects(() => listImages("nonexistent.cbr"), Error);
  if (err.message.includes("Unsupported")) {
    throw new Error(`.cbr が RAR へディスパッチされていない: ${err.message}`);
  }
});

Deno.test("getImageBase64: 存在しない RAR はエラー", async () => {
  await assertRejects(
    () => getImageBase64("nonexistent.rar", "image.jpg"),
    Error,
  );
});

Deno.test("getImageBase64: 未対応拡張子は Unsupported エラー", async () => {
  await assertRejects(
    () => getImageBase64("test.tar", "image.jpg"),
    Error,
    "Unsupported",
  );
});
