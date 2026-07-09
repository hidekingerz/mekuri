import { assertEquals, assertFalse } from "@std/assert";
import { Store } from "./store.ts";

async function withTempStorePath(
  fn: (path: string) => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir();
  try {
    await fn(`${dir}/settings.json`);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("load uses defaults when file is missing and does not write", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, { defaults: { favorites: [] } });
    assertEquals(store.get<string[]>("favorites"), []);
    // defaults を読んだだけではファイルは作られない（Tauri 版と同じ）。
    await assertRejectsNotFound(() => Deno.stat(path));
  });
});

Deno.test("get returns undefined for unknown key", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path);
    assertEquals(store.get("missing"), undefined);
    assertFalse(store.has("missing"));
  });
});

Deno.test("set persists when autoSave is enabled and reload reads it back", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, { autoSave: true });
    await store.set("windowSettings", { width: 800, height: 600 });

    const reopened = await Store.load(path);
    assertEquals(reopened.get("windowSettings"), { width: 800, height: 600 });
  });
});

Deno.test("set does not persist when autoSave is disabled", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, { autoSave: false });
    await store.set("favorites", ["/a"]);
    // メモリ上には反映されるがファイルは未作成。
    assertEquals(store.get<string[]>("favorites"), ["/a"]);
    await assertRejectsNotFound(() => Deno.stat(path));
  });
});

Deno.test("explicit save writes current state to disk", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, { autoSave: false });
    await store.set("viewMode", "spread");
    await store.save();

    const reopened = await Store.load(path);
    assertEquals(reopened.get("viewMode"), "spread");
  });
});

Deno.test("delete removes a key and reports success", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, {
      defaults: { a: 1, b: 2 },
      autoSave: true,
    });
    assertEquals(await store.delete("a"), true);
    assertEquals(await store.delete("a"), false);

    const reopened = await Store.load(path);
    assertFalse(reopened.has("a"));
    assertEquals(reopened.get("b"), 2);
  });
});

Deno.test("keys and entries reflect stored state", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, { defaults: { x: 1, y: 2 } });
    assertEquals(store.keys().sort(), ["x", "y"]);
    assertEquals(store.entries().sort(), [["x", 1], ["y", 2]]);
  });
});

Deno.test("clear empties the store", async () => {
  await withTempStorePath(async (path) => {
    const store = await Store.load(path, {
      defaults: { a: 1 },
      autoSave: true,
    });
    await store.clear();
    assertEquals(store.keys(), []);

    const reopened = await Store.load(path);
    assertEquals(reopened.keys(), []);
  });
});

Deno.test("load throws when file holds a non-object JSON value", async () => {
  await withTempStorePath(async (path) => {
    await Deno.writeTextFile(path, "[1, 2, 3]");
    let threw = false;
    try {
      await Store.load(path);
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
  });
});

/** Deno.stat 等が NotFound で reject することを検証するヘルパ。 */
async function assertRejectsNotFound(
  fn: () => Promise<unknown>,
): Promise<void> {
  let notFound = false;
  try {
    await fn();
  } catch (err) {
    notFound = err instanceof Deno.errors.NotFound;
  }
  assertEquals(notFound, true);
}
