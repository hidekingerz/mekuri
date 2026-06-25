import { assertEquals, assertInstanceOf } from "@std/assert";
import { load, type StoreInvoke, WebviewStore } from "./store.ts";

/** 呼び出しを記録する mock invoke を作る。 */
function mockInvoke(
  result: unknown,
): {
  invoke: StoreInvoke;
  calls: Array<[string, Record<string, unknown> | undefined]>;
} {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const invoke: StoreInvoke = (command, args) => {
    calls.push([command, args]);
    return Promise.resolve(result);
  };
  return { invoke, calls };
}

Deno.test("get forwards store_get with the key", async () => {
  const { invoke, calls } = mockInvoke(["a.zip"]);
  const store = new WebviewStore(invoke);
  const value = await store.get<string[]>("favorites");
  assertEquals(value, ["a.zip"]);
  assertEquals(calls, [["store_get", { key: "favorites" }]]);
});

Deno.test("get returns null when backend has no value", async () => {
  const { invoke } = mockInvoke(null);
  const store = new WebviewStore(invoke);
  assertEquals(await store.get("missing"), null);
});

Deno.test("set forwards store_set with key and value", async () => {
  const { invoke, calls } = mockInvoke(null);
  const store = new WebviewStore(invoke);
  await store.set("favorites", ["a.zip", "b.zip"]);
  assertEquals(calls, [["store_set", {
    key: "favorites",
    value: ["a.zip", "b.zip"],
  }]]);
});

Deno.test("load returns a WebviewStore, ignoring name and options", async () => {
  const store = await load("settings.json", {
    defaults: { favorites: [] },
    autoSave: true,
  });
  assertInstanceOf(store, WebviewStore);
});
