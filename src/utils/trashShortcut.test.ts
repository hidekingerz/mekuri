import { describe, expect, it } from "vitest";
import { isTrashShortcut } from "./trashShortcut";

describe("isTrashShortcut", () => {
  it("accepts the forward Delete key", () => {
    expect(isTrashShortcut({ key: "Delete", metaKey: false, ctrlKey: false })).toBe(true);
  });

  it("accepts Cmd+Backspace (Finder style) and Ctrl+Backspace", () => {
    expect(isTrashShortcut({ key: "Backspace", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isTrashShortcut({ key: "Backspace", metaKey: false, ctrlKey: true })).toBe(true);
  });

  it("ignores a plain Backspace so a stray key press cannot start a deletion", () => {
    expect(isTrashShortcut({ key: "Backspace", metaKey: false, ctrlKey: false })).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isTrashShortcut({ key: "a", metaKey: true, ctrlKey: false })).toBe(false);
  });
});
