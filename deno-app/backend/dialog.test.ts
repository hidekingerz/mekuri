import { assertEquals, assertThrows } from "@std/assert";
import {
  buildFolderPickerCommand,
  type CommandRunner,
  parsePickerOutput,
  pickFolder,
} from "./dialog.ts";

Deno.test("buildFolderPickerCommand: macOS は osascript で choose folder", () => {
  const c = buildFolderPickerCommand("darwin");
  assertEquals(c.cmd, "osascript");
  assertEquals(c.args, ["-e", "POSIX path of (choose folder)"]);
});

Deno.test("buildFolderPickerCommand: Linux は zenity のディレクトリ選択", () => {
  const c = buildFolderPickerCommand("linux");
  assertEquals(c.cmd, "zenity");
  assertEquals(c.args, ["--file-selection", "--directory"]);
});

Deno.test("buildFolderPickerCommand: Windows は PowerShell の FolderBrowserDialog", () => {
  const c = buildFolderPickerCommand("windows");
  assertEquals(c.cmd, "powershell");
  assertEquals(c.args[0], "-NoProfile");
  assertEquals(c.args[1], "-Command");
});

Deno.test("buildFolderPickerCommand: 未対応 OS は例外", () => {
  assertThrows(
    () => buildFolderPickerCommand("freebsd" as typeof Deno.build.os),
    Error,
    "Unsupported OS",
  );
});

Deno.test("parsePickerOutput: 改行・末尾スラッシュを正規化", () => {
  assertEquals(
    parsePickerOutput("/Users/me/Documents/\n"),
    "/Users/me/Documents",
  );
  assertEquals(parsePickerOutput("  /tmp/foo  "), "/tmp/foo");
});

Deno.test("parsePickerOutput: 空はキャンセル相当で null", () => {
  assertEquals(parsePickerOutput(""), null);
  assertEquals(parsePickerOutput("  \n "), null);
});

Deno.test("parsePickerOutput: ルートは末尾スラッシュを残す", () => {
  assertEquals(parsePickerOutput("/\n"), "/");
});

Deno.test("pickFolder: 選択パスを正規化して返す", async () => {
  const runner: CommandRunner = (_c) =>
    Promise.resolve({ code: 0, stdout: "/Users/me/Pictures/\n" });
  assertEquals(await pickFolder("darwin", runner), "/Users/me/Pictures");
});

Deno.test("pickFolder: 終了コード非 0（キャンセル）は null", async () => {
  const runner: CommandRunner = (_c) =>
    Promise.resolve({ code: 1, stdout: "" });
  assertEquals(await pickFolder("darwin", runner), null);
});

Deno.test("pickFolder: 出力が空なら null", async () => {
  const runner: CommandRunner = (_c) =>
    Promise.resolve({ code: 0, stdout: "\n" });
  assertEquals(await pickFolder("linux", runner), null);
});

Deno.test("pickFolder: OS に応じたコマンドが runner へ渡る", async () => {
  let received: string | null = null;
  const runner: CommandRunner = (c) => {
    received = c.cmd;
    return Promise.resolve({ code: 0, stdout: "/home/me\n" });
  };
  await pickFolder("linux", runner);
  assertEquals(received, "zenity");
});
