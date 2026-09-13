import { describe, expect, it } from "vitest";
import { trashConfirmMessage } from "./trashConfirm";

describe("trashConfirmMessage", () => {
  it("names the single file", () => {
    expect(trashConfirmMessage(["/a/b.zip"])).toBe(
      "Are you sure you want to move this file to the trash?\n\n/a/b.zip",
    );
  });

  it("lists up to five files with the count", () => {
    const paths = ["/1", "/2", "/3"];
    expect(trashConfirmMessage(paths)).toBe(
      "Are you sure you want to move 3 files to the trash?\n\n/1\n/2\n/3",
    );
  });

  it("truncates the preview after five files", () => {
    const paths = ["/1", "/2", "/3", "/4", "/5", "/6", "/7"];
    expect(trashConfirmMessage(paths)).toBe(
      "Are you sure you want to move 7 files to the trash?\n\n/1\n/2\n/3\n/4\n/5\n…and 2 more",
    );
  });
});
