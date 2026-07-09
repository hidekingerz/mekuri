import { assertEquals, assertRejects } from "@std/assert";
import {
  readDirectory,
  readFileBase64,
  searchDirectory,
  trashFile,
} from "./fs.ts";

/** テスト用の一時ディレクトリを作り、関数実行後に必ず削除する。 */
async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "mekuri_fs_test_" });
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("readDirectory: ディレクトリ・アーカイブ・PDF のみ返し、その他/隠しは除外", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/subdir`);
    await Deno.writeTextFile(`${dir}/a.zip`, "");
    await Deno.writeTextFile(`${dir}/b.pdf`, "");
    await Deno.writeTextFile(`${dir}/note.txt`, "");
    await Deno.writeTextFile(`${dir}/.hidden.zip`, "");

    const entries = await readDirectory(dir);
    const names = entries.map((e) => e.name);
    assertEquals(names, ["subdir", "a.zip", "b.pdf"]);

    const sub = entries.find((e) => e.name === "subdir")!;
    assertEquals(sub.is_dir, true);
    const zip = entries.find((e) => e.name === "a.zip")!;
    assertEquals(zip.is_archive, true);
    const pdf = entries.find((e) => e.name === "b.pdf")!;
    assertEquals(pdf.is_pdf, true);
  });
});

Deno.test("readDirectory: ディレクトリ優先・ファイルは自然順でソート", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/img10.zip`, "");
    await Deno.writeTextFile(`${dir}/img2.zip`, "");
    await Deno.mkdir(`${dir}/zfolder`);

    const names = (await readDirectory(dir)).map((e) => e.name);
    assertEquals(names, ["zfolder", "img2.zip", "img10.zip"]);
  });
});

Deno.test("readDirectory: has_subfolders を判定", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/parent`);
    await Deno.mkdir(`${dir}/parent/child`);
    await Deno.mkdir(`${dir}/empty`);

    const entries = await readDirectory(dir);
    assertEquals(
      entries.find((e) => e.name === "parent")!.has_subfolders,
      true,
    );
    assertEquals(
      entries.find((e) => e.name === "empty")!.has_subfolders,
      false,
    );
  });
});

Deno.test("readDirectory: 存在しないパスはエラー", async () => {
  await assertRejects(
    () => readDirectory("/nonexistent_mekuri_dir_12345"),
    Error,
    "Failed to read directory",
  );
});

Deno.test("searchDirectory: 再帰的にファイルとフォルダをマッチ（大文字小文字無視）", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/subdir`);
    await Deno.writeTextFile(`${dir}/test.zip`, "");
    await Deno.writeTextFile(`${dir}/subdir/nested.ZIP`, "");
    await Deno.writeTextFile(`${dir}/subdir/other.txt`, "");

    const names = (await searchDirectory(dir, "zip")).map((e) => e.name);
    assertEquals(names.includes("test.zip"), true);
    assertEquals(names.includes("nested.ZIP"), true);
    assertEquals(names.includes("other.txt"), false);
  });
});

Deno.test("searchDirectory: フォルダ名でマッチ", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/manga_vol1`);
    await Deno.mkdir(`${dir}/photos`);

    const result = await searchDirectory(dir, "manga");
    assertEquals(result.length, 1);
    assertEquals(result[0].name, "manga_vol1");
    assertEquals(result[0].is_dir, true);
  });
});

Deno.test("searchDirectory: マッチなしは空配列", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/test.zip`, "");
    assertEquals(await searchDirectory(dir, "nonexistent"), []);
  });
});

Deno.test("readFileBase64: ファイル内容を Base64 で返す", async () => {
  await withTempDir(async (dir) => {
    const path = `${dir}/data.bin`;
    await Deno.writeFile(path, new Uint8Array([104, 105])); // "hi"
    assertEquals(await readFileBase64(path), btoa("hi"));
  });
});

Deno.test("readFileBase64: 存在しないファイルはエラー", async () => {
  await assertRejects(
    () => readFileBase64("/nonexistent_mekuri_file_12345.bin"),
    Error,
    "Failed to read file",
  );
});

Deno.test("trashFile: 存在しないパスはエラー（deleter は呼ばれない）", async () => {
  let called = false;
  await assertRejects(
    () =>
      trashFile("/nonexistent_mekuri_file_12345.zip", () => {
        called = true;
        return Promise.resolve();
      }),
    Error,
    "File does not exist",
  );
  assertEquals(called, false);
});

Deno.test("trashFile: ディレクトリはエラー（deleter は呼ばれない）", async () => {
  await withTempDir(async (dir) => {
    let called = false;
    await assertRejects(
      () =>
        trashFile(dir, () => {
          called = true;
          return Promise.resolve();
        }),
      Error,
      "Path is not a file",
    );
    assertEquals(called, false);
  });
});

Deno.test("trashFile: 通常ファイルは deleter にパスを渡して成功", async () => {
  await withTempDir(async (dir) => {
    const path = `${dir}/to_trash.zip`;
    await Deno.writeTextFile(path, "");
    let received: string | null = null;
    await trashFile(path, (p) => {
      received = p;
      return Promise.resolve();
    });
    assertEquals(received, path);
  });
});
