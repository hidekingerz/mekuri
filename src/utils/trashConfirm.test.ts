import { describe, expect, it } from "vitest";
import { trashConfirmLines, trashConfirmTitle } from "./trashConfirm";

describe("trashConfirmTitle", () => {
  it("describes one file or a count", () => {
    expect(trashConfirmTitle(1)).toBe("ファイルをゴミ箱に移動しますか?");
    expect(trashConfirmTitle(3)).toBe("3 件のファイルをゴミ箱に移動しますか?");
  });
});

describe("trashConfirmLines", () => {
  it("shows file names, not full paths", () => {
    expect(trashConfirmLines(["/a/b/score.zip"])).toEqual(["score.zip"]);
  });

  it("caps the preview at 5 and counts the rest", () => {
    const paths = ["/1.zip", "/2.zip", "/3.zip", "/4.zip", "/5.zip", "/6.zip", "/7.zip"];
    expect(trashConfirmLines(paths)).toEqual([
      "1.zip",
      "2.zip",
      "3.zip",
      "4.zip",
      "5.zip",
      "…ほか 2 件",
    ]);
  });
});
