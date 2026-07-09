import { assertEquals } from "@std/assert";
import { MAIN_WINDOW_TITLE, mainWindowOptions } from "./windowConfig.ts";

Deno.test("mainWindowOptions falls back to defaults when no settings", () => {
  assertEquals(mainWindowOptions(), {
    title: MAIN_WINDOW_TITLE,
    width: 1000,
    height: 700,
    resizable: true,
  });
});

Deno.test("mainWindowOptions uses saved width and height", () => {
  assertEquals(mainWindowOptions({ width: 1280, height: 800 }), {
    title: "mekuri",
    width: 1280,
    height: 800,
    resizable: true,
  });
});

Deno.test("mainWindowOptions fills missing dimensions from defaults", () => {
  assertEquals(mainWindowOptions({ width: 1440 }), {
    title: "mekuri",
    width: 1440,
    height: 700,
    resizable: true,
  });
});
