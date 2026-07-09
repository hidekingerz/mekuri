import { assertEquals, assertThrows } from "@std/assert";
import {
  APP_IDENTIFIER,
  appConfigDir,
  type PathEnv,
  SETTINGS_FILE_NAME,
  settingsPath,
} from "./paths.ts";

/** 指定の OS・環境変数マップで PathEnv を作る。 */
function makeEnv(
  os: PathEnv["os"],
  vars: Record<string, string>,
): PathEnv {
  return { os, getEnv: (key) => vars[key] };
}

Deno.test("appConfigDir on macOS uses Application Support + identifier", () => {
  const env = makeEnv("darwin", { HOME: "/Users/test" });
  assertEquals(
    appConfigDir(env),
    `/Users/test/Library/Application Support/${APP_IDENTIFIER}`,
  );
});

Deno.test("appConfigDir on Linux honors XDG_CONFIG_HOME", () => {
  const env = makeEnv("linux", {
    HOME: "/home/test",
    XDG_CONFIG_HOME: "/home/test/.xdg",
  });
  assertEquals(appConfigDir(env), `/home/test/.xdg/${APP_IDENTIFIER}`);
});

Deno.test("appConfigDir on Linux falls back to ~/.config", () => {
  const env = makeEnv("linux", { HOME: "/home/test" });
  assertEquals(appConfigDir(env), `/home/test/.config/${APP_IDENTIFIER}`);
});

Deno.test("appConfigDir on Linux treats empty XDG_CONFIG_HOME as unset", () => {
  const env = makeEnv("linux", { HOME: "/home/test", XDG_CONFIG_HOME: "" });
  assertEquals(appConfigDir(env), `/home/test/.config/${APP_IDENTIFIER}`);
});

Deno.test("appConfigDir on Windows uses APPDATA with backslashes", () => {
  const env = makeEnv("windows", {
    APPDATA: "C:\\Users\\test\\AppData\\Roaming",
  });
  assertEquals(
    appConfigDir(env),
    `C:\\Users\\test\\AppData\\Roaming\\${APP_IDENTIFIER}`,
  );
});

Deno.test("settingsPath appends settings.json", () => {
  const env = makeEnv("darwin", { HOME: "/Users/test" });
  assertEquals(
    settingsPath(env),
    `/Users/test/Library/Application Support/${APP_IDENTIFIER}/${SETTINGS_FILE_NAME}`,
  );
});

Deno.test("settingsPath on Windows joins with backslash", () => {
  const env = makeEnv("windows", { APPDATA: "C:\\Roaming" });
  assertEquals(
    settingsPath(env),
    `C:\\Roaming\\${APP_IDENTIFIER}\\${SETTINGS_FILE_NAME}`,
  );
});

Deno.test("appConfigDir throws when required env var is missing", () => {
  assertThrows(
    () => appConfigDir(makeEnv("darwin", {})),
    Error,
    "Missing required environment variable: HOME",
  );
  assertThrows(
    () => appConfigDir(makeEnv("windows", {})),
    Error,
    "Missing required environment variable: APPDATA",
  );
});
