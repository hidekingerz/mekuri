import { assertEquals, assertRejects } from "@std/assert";
import { invoke } from "./invoke.ts";
import type { DirectoryEntry } from "./invoke.ts";

Deno.test("invoke: unknown command rejects", async () => {
  await assertRejects(
    () => invoke("no_such_command"),
    Error,
    "Unknown command: no_such_command",
  );
});

Deno.test("invoke: missing argument rejects", async () => {
  await assertRejects(
    () => invoke("read_directory"),
    Error,
    "Missing or invalid argument: path",
  );
});

Deno.test("invoke: read_directory dispatches to backend", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeFile(`${dir}/a.zip`, new Uint8Array([1, 2, 3]));
    const entries = await invoke<DirectoryEntry[]>("read_directory", {
      path: dir,
    });
    assertEquals(entries.length, 1);
    assertEquals(entries[0].name, "a.zip");
    assertEquals(entries[0].is_archive, true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("invoke: search_directory dispatches to backend", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeFile(`${dir}/hello.cbz`, new Uint8Array([1]));
    await Deno.writeFile(`${dir}/other.zip`, new Uint8Array([1]));
    const entries = await invoke<DirectoryEntry[]>("search_directory", {
      path: dir,
      query: "hello",
    });
    assertEquals(entries.length, 1);
    assertEquals(entries[0].name, "hello.cbz");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("invoke: read_file_base64 dispatches to backend", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/data.bin`;
    await Deno.writeFile(file, new Uint8Array([72, 105])); // "Hi"
    const base64 = await invoke<string>("read_file_base64", { path: file });
    assertEquals(base64, "SGk=");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("invoke: list_archive_images forwards format errors from backend", async () => {
  // 未対応拡張子は backend の detectFormat が拒否する。エラーが透過することで
  // archive 系コマンドが backend へ正しくディスパッチされたことを確認する。
  await assertRejects(
    () => invoke("list_archive_images", { archivePath: "/tmp/file.txt" }),
    Error,
    "Unsupported archive format: .txt",
  );
});

Deno.test("invoke: analyze_archive_contents forwards format errors from backend", async () => {
  await assertRejects(
    () => invoke("analyze_archive_contents", { archivePath: "/tmp/file.7z" }),
    Error,
    "Unsupported archive format: .7z",
  );
});

Deno.test("invoke: extract_nested_archive forwards format errors from backend", async () => {
  await assertRejects(
    () =>
      invoke("extract_nested_archive", {
        parentPath: "/tmp/file.tar",
        nestedName: "inner.zip",
      }),
    Error,
    "Unsupported archive format: .tar",
  );
});
