import { describe, expect, it } from "vitest";
import { trashConfirmMessage } from "./trashConfirm";

describe("trashConfirmMessage", () => {
  it("names the single file", () => {
    expect(trashConfirmMessage(["/a/b.zip"])).toBe(
      "このファイルをゴミ箱に移動しますか?\n\n/a/b.zip",
    );
  });

  it("lists up to five files with the count", () => {
    const paths = ["/1", "/2", "/3"];
    expect(trashConfirmMessage(paths)).toBe("3 件のファイルをゴミ箱に移動しますか?\n\n/1\n/2\n/3");
  });

  it("truncates the preview after five files", () => {
    const paths = ["/1", "/2", "/3", "/4", "/5", "/6", "/7"];
    expect(trashConfirmMessage(paths)).toBe(
      "7 件のファイルをゴミ箱に移動しますか?\n\n/1\n/2\n/3\n/4\n/5\n…ほか 2 件",
    );
  });
});
