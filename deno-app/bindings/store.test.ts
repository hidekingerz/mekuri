import { assertEquals, assertRejects } from "@std/assert";
import { Store } from "../backend/mod.ts";
import { handleStoreCommand } from "./store.ts";

async function tempStore(
  defaults: Record<string, unknown> = {},
): Promise<Store> {
  const dir = await Deno.makeTempDir();
  return await Store.load(`${dir}/settings.json`, {
    defaults,
    autoSave: true,
  });
}

Deno.test("store_get は未設定キーで null を返す", async () => {
  const store = await tempStore();
  assertEquals(
    await handleStoreCommand(store, "store_get", { key: "x" }),
    null,
  );
});

Deno.test("store_get は既定値を返す", async () => {
  const store = await tempStore({ favorites: ["/a"] });
  assertEquals(
    await handleStoreCommand(store, "store_get", { key: "favorites" }),
    ["/a"],
  );
});

Deno.test("store_set は値を設定し store_get で読める", async () => {
  const store = await tempStore();
  const set = await handleStoreCommand(store, "store_set", {
    key: "windowSettings",
    value: { width: 800 },
  });
  assertEquals(set, null);
  assertEquals(
    await handleStoreCommand(store, "store_get", { key: "windowSettings" }),
    { width: 800 },
  );
});

Deno.test("store_set は autoSave でファイルへ永続化される", async () => {
  const store = await tempStore();
  await handleStoreCommand(store, "store_set", { key: "k", value: 1 });
  const reopened = await Store.load(store.path);
  assertEquals(reopened.get("k"), 1);
});

Deno.test("store_get は key 引数が無いと reject する", async () => {
  const store = await tempStore();
  await assertRejects(
    () => handleStoreCommand(store, "store_get", {}),
    Error,
    "Missing or invalid argument: key",
  );
});

Deno.test("未知のコマンドは reject する", async () => {
  const store = await tempStore();
  await assertRejects(
    () => handleStoreCommand(store, "store_clear", { key: "k" }),
    Error,
    "Unknown store command: store_clear",
  );
});
