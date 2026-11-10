import { describe, expect, it } from "vitest";
import {
  folderTrashConfirmLines,
  folderTrashConfirmTitle,
  trashConfirmLines,
  trashConfirmTitle,
} from "./trashConfirm";

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

describe("folderTrashConfirmTitle", () => {
  it("names the folder", () => {
    expect(folderTrashConfirmTitle("/scores/old")).toBe("フォルダ「old」をゴミ箱に移動しますか?");
  });
});

describe("folderTrashConfirmLines", () => {
  it("says how many files go with the folder", () => {
    expect(folderTrashConfirmLines(12)).toEqual([
      "中のファイル 12 件（サブフォルダを含む）も一緒に移動します",
    ]);
  });

  it("says when the folder has no files", () => {
    expect(folderTrashConfirmLines(0)).toEqual(["フォルダの中にファイルはありません"]);
  });
});
