import { assertEquals } from "@std/assert";
import {
  Menu,
  type MenuHost,
  type MenuInvokeFn,
  MenuItem,
  PredefinedMenuItem,
} from "./menu.ts";

Deno.test("MenuItem.new produces an item node with a unique id", async () => {
  const a = await MenuItem.new({ text: "Open", action: () => {} });
  const b = await MenuItem.new({ text: "Close" });
  assertEquals(a.__kind, "item");
  assertEquals(a.text, "Open");
  assertEquals(b.__kind, "item");
  // ids are distinct between items.
  assertEquals(a.id === b.id, false);
});

Deno.test("PredefinedMenuItem.new produces a separator node", async () => {
  const sep = await PredefinedMenuItem.new({ item: "Separator" });
  assertEquals(sep.__kind, "separator");
});

Deno.test("popup serializes items and forwards the cursor position", async () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  const fakeInvoke: MenuInvokeFn = (command, args) => {
    calls.push({ command, args });
    return Promise.resolve(null);
  };
  const host: MenuHost = {};

  const open = await MenuItem.new({ text: "Open", action: () => {} });
  const sep = await PredefinedMenuItem.new({ item: "Separator" });
  const close = await MenuItem.new({ text: "Close", action: () => {} });
  const menu = await Menu.new({ items: [open, sep, close] });

  await menu.popup({ x: 5, y: 7 }, host, fakeInvoke);

  assertEquals(calls, [{
    command: "menu_popup",
    args: {
      x: 5,
      y: 7,
      items: [
        { type: "item", id: open.id, label: "Open" },
        { type: "separator" },
        { type: "item", id: close.id, label: "Close" },
      ],
    },
  }]);
});

Deno.test("popup registers actions and the click hook runs them", async () => {
  const fakeInvoke: MenuInvokeFn = () => Promise.resolve(null);
  const host: MenuHost = {};
  let opened = 0;

  const open = await MenuItem.new({ text: "Open", action: () => opened++ });
  const menu = await Menu.new({ items: [open] });
  await menu.popup({ x: 0, y: 0 }, host, fakeInvoke);

  host.__mekuriMenuClick?.(open.id);
  assertEquals(opened, 1);

  // Unknown id is a safe no-op.
  host.__mekuriMenuClick?.("missing");
  assertEquals(opened, 1);
});

Deno.test("popup clears stale actions between popups", async () => {
  const fakeInvoke: MenuInvokeFn = () => Promise.resolve(null);
  const host: MenuHost = {};
  let firstRuns = 0;

  const first = await MenuItem.new({
    text: "First",
    action: () => firstRuns++,
  });
  const firstMenu = await Menu.new({ items: [first] });
  await firstMenu.popup({ x: 0, y: 0 }, host, fakeInvoke);

  const second = await MenuItem.new({ text: "Second", action: () => {} });
  const secondMenu = await Menu.new({ items: [second] });
  await secondMenu.popup({ x: 0, y: 0 }, host, fakeInvoke);

  // The first menu's action is no longer registered after the second popup.
  host.__mekuriMenuClick?.(first.id);
  assertEquals(firstRuns, 0);
});

Deno.test("popup defaults the position to the origin", async () => {
  let received: Record<string, unknown> | undefined;
  const fakeInvoke: MenuInvokeFn = (_command, args) => {
    received = args;
    return Promise.resolve(null);
  };
  const host: MenuHost = {};

  const item = await MenuItem.new({ text: "Open" });
  const menu = await Menu.new({ items: [item] });
  await menu.popup(undefined, host, fakeInvoke);

  assertEquals(received?.x, 0);
  assertEquals(received?.y, 0);
});
