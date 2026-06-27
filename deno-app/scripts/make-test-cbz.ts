/**
 * smoke 用のテスト CBZ（ZIP）を生成する。1x1 PNG を数枚詰めた最小の漫画アーカイブ。
 * 使い方: `deno run -A scripts/make-test-cbz.ts <出力パス>`
 */

import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip-js/zip-js";

// 1x1 透明 PNG（実画像なので webview の <img> が実際にデコードできる）。
const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

const out = Deno.args[0] ?? "test.cbz";
const writer = new ZipWriter(new Uint8ArrayWriter());
for (const name of ["page001.png", "page002.png", "page003.png"]) {
  await writer.add(name, new Uint8ArrayReader(PNG_1X1));
}
await Deno.writeFile(out, await writer.close());
console.error(`[make-test-cbz] wrote ${out}`);
