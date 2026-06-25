import { assert, assertEquals } from "@std/assert";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip-js/zip-js";
import {
  analyzeContents,
  extractNestedArchive,
  getImageBase64,
  listImages,
} from "./zip.ts";

/** 指定エントリを持つ ZIP を一時ファイルに作成し、そのパスを返す。 */
async function createTestZip(
  entries: [string, Uint8Array][],
): Promise<string> {
  const zipWriter = new ZipWriter(new Uint8ArrayWriter());
  for (const [name, data] of entries) {
    await zipWriter.add(name, new Uint8ArrayReader(data));
  }
  const zipped = await zipWriter.close();
  const path = await Deno.makeTempFile({ suffix: ".zip" });
  await Deno.writeFile(path, zipped);
  return path;
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

Deno.test("listImages は画像のみを自然順で返す", async () => {
  const path = await createTestZip([
    ["page03.jpg", bytes("fake-jpg-3")],
    ["page01.jpg", bytes("fake-jpg-1")],
    ["readme.txt", bytes("not an image")],
    ["page02.png", bytes("fake-png-2")],
    ["__MACOSX/._page01.jpg", bytes("macos metadata")],
  ]);

  const result = await listImages(path);
  assertEquals(result, ["page01.jpg", "page02.png", "page03.jpg"]);
});

Deno.test("listImages は画像が無ければ空配列", async () => {
  const path = await createTestZip([["readme.txt", bytes("no images here")]]);
  const result = await listImages(path);
  assertEquals(result, []);
});

Deno.test("analyzeContents は画像があれば Images を返す", async () => {
  const path = await createTestZip([
    ["b.png", bytes("b")],
    ["a.jpg", bytes("a")],
    ["nested.zip", bytes("nested")],
  ]);
  const result = await analyzeContents(path);
  assertEquals(result, { type: "Images", names: ["a.jpg", "b.png"] });
});

Deno.test("analyzeContents は画像が無くアーカイブがあれば NestedArchives", async () => {
  const path = await createTestZip([
    ["readme.txt", bytes("text")],
    ["vol2.cbz", bytes("v2")],
    ["vol1.zip", bytes("v1")],
  ]);
  const result = await analyzeContents(path);
  assertEquals(result, {
    type: "NestedArchives",
    names: ["vol1.zip", "vol2.cbz"],
  });
});

Deno.test("analyzeContents は画像もアーカイブも無ければ Empty", async () => {
  const path = await createTestZip([["readme.txt", bytes("text")]]);
  const result = await analyzeContents(path);
  assertEquals(result, { type: "Empty" });
});

Deno.test("getImageBase64 は data URL を返し復号できる", async () => {
  const pngData = bytes("fake-png-data");
  const path = await createTestZip([["image.png", pngData]]);

  const result = await getImageBase64(path, "image.png");
  assert(result.startsWith("data:image/png;base64,"));

  const b64 = result.slice("data:image/png;base64,".length);
  const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  assertEquals(decoded, pngData);
});

Deno.test("getImageBase64 は存在しないエントリでエラー", async () => {
  const path = await createTestZip([["image.png", bytes("data")]]);
  try {
    await getImageBase64(path, "nonexistent.png");
    throw new Error("should have thrown");
  } catch (e) {
    assert(e instanceof Error && e.message.includes("Entry not found"));
  }
});

Deno.test("extractNestedArchive は一時ファイルへ展開しパスを返す", async () => {
  const nestedData = bytes("inner-archive-bytes");
  const path = await createTestZip([["sub/inner.zip", nestedData]]);

  const extracted = await extractNestedArchive(path, "sub/inner.zip");
  assert(extracted.endsWith("inner.zip"));

  const readBack = await Deno.readFile(extracted);
  assertEquals(readBack, nestedData);
});

Deno.test("extractNestedArchive は存在しないエントリでエラー", async () => {
  const path = await createTestZip([["sub/inner.zip", bytes("x")]]);
  try {
    await extractNestedArchive(path, "missing.zip");
    throw new Error("should have thrown");
  } catch (e) {
    assert(e instanceof Error && e.message.includes("Entry not found"));
  }
});

Deno.test("listImages は壊れた/非 ZIP ファイルでエラー", async () => {
  const path = await Deno.makeTempFile({ suffix: ".zip" });
  await Deno.writeFile(path, bytes("not a real zip"));
  try {
    await listImages(path);
    throw new Error("should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }
});
