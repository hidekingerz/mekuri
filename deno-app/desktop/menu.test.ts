import { assertEquals, assertRejects } from "@std/assert";
import {
  type ContextMenuWindow,
  extractMenuClickId,
  handleMenuCommand,
  menuClickScript,
  type NativeMenuItem,
  type SerializedMenuItem,
  toNativeMenuItems,
} from "./menu.ts";

Deno.test("toNativeMenuItems converts items and separators", () => {
  const input: SerializedMenuItem[] = [
    { type: "item", id: "a", label: "Open" },
    { type: "separator" },
    { type: "item", id: "b", label: "Close" },
  ];
  assertEquals(toNativeMenuItems(input), [
    { item: { label: "Open", id: "a", enabled: true } },
    { role: { role: "separator" } },
    { item: { label: "Close", id: "b", enabled: true } },
  ]);
});

Deno.test("extractMenuClickId reads a string detail", () => {
  assertEquals(extractMenuClickId("item-1"), "item-1");
});

Deno.test("extractMenuClickId reads an object detail with id", () => {
  assertEquals(extractMenuClickId({ id: "item-2" }), "item-2");
});

Deno.test("extractMenuClickId returns null for unusable detail", () => {
  assertEquals(extractMenuClickId(null), null);
  assertEquals(extractMenuClickId(42), null);
  assertEquals(extractMenuClickId({ other: "x" }), null);
});

Deno.test("menuClickScript embeds the id and guards the hook", () => {
  assertEquals(
    menuClickScript("item-1"),
    'globalThis.__mekuriMenuClick&&globalThis.__mekuriMenuClick("item-1")',
  );
});

Deno.test("handleMenuCommand shows the native context menu", async () => {
  const calls: Array<{ x: number; y: number; items: NativeMenuItem[] }> = [];
  const win: ContextMenuWindow = {
    showContextMenu: (x, y, items) => {
      calls.push({ x, y, items });
    },
  };

  const result = await handleMenuCommand(win, "menu_popup", {
    x: 10,
    y: 20,
    items: [{ type: "item", id: "a", label: "Open" }],
  });

  assertEquals(result, null);
  assertEquals(calls, [{
    x: 10,
    y: 20,
    items: [{ item: { label: "Open", id: "a", enabled: true } }],
  }]);
});

Deno.test("handleMenuCommand rejects unknown commands", async () => {
  const win: ContextMenuWindow = { showContextMenu: () => {} };
  await assertRejects(
    () => handleMenuCommand(win, "menu_other", { x: 0, y: 0, items: [] }),
    Error,
    "Unknown menu command",
  );
});

Deno.test("handleMenuCommand rejects non-numeric coordinates", async () => {
  const win: ContextMenuWindow = { showContextMenu: () => {} };
  await assertRejects(
    () =>
      handleMenuCommand(win, "menu_popup", {
        x: "10" as unknown as number,
        y: 0,
        items: [],
      }),
    Error,
    "must be numbers",
  );
});

Deno.test("handleMenuCommand rejects a non-array items argument", async () => {
  const win: ContextMenuWindow = { showContextMenu: () => {} };
  await assertRejects(
    () =>
      handleMenuCommand(win, "menu_popup", {
        x: 0,
        y: 0,
        items: "nope" as unknown as SerializedMenuItem[],
      }),
    Error,
    "must be an array",
  );
});
