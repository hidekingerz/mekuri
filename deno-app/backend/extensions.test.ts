import { assertEquals } from "@std/assert";
import {
  isArchiveFile,
  isImageFile,
  isPdfFile,
  mimeTypeFromName,
} from "./extensions.ts";

Deno.test("isArchiveFile: アーカイブ拡張子を判定（大文字小文字無視）", () => {
  assertEquals(isArchiveFile("a.zip"), true);
  assertEquals(isArchiveFile("a.CBZ"), true);
  assertEquals(isArchiveFile("a.rar"), true);
  assertEquals(isArchiveFile("a.cbr"), true);
  assertEquals(isArchiveFile("a.7z"), true);
  assertEquals(isArchiveFile("a.pdf"), false);
  assertEquals(isArchiveFile("a.txt"), false);
});

Deno.test("isPdfFile: PDF 拡張子を判定", () => {
  assertEquals(isPdfFile("doc.pdf"), true);
  assertEquals(isPdfFile("doc.PDF"), true);
  assertEquals(isPdfFile("doc.zip"), false);
});

Deno.test("isImageFile: 画像拡張子を判定", () => {
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif", "avif"]) {
    assertEquals(isImageFile(`img.${ext}`), true);
  }
  assertEquals(isImageFile("img.bmp"), false);
});

Deno.test("mimeTypeFromName: 拡張子から MIME を推定", () => {
  assertEquals(mimeTypeFromName("a.png"), "image/png");
  assertEquals(mimeTypeFromName("a.webp"), "image/webp");
  assertEquals(mimeTypeFromName("a.gif"), "image/gif");
  assertEquals(mimeTypeFromName("a.avif"), "image/avif");
  assertEquals(mimeTypeFromName("a.jpg"), "image/jpeg");
  assertEquals(mimeTypeFromName("a.unknown"), "image/jpeg");
});
