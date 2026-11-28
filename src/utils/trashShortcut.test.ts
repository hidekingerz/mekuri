import { describe, expect, it } from "vitest";
import { isMacUserAgent, isTrashShortcut } from "./trashShortcut";

const press = (key: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  ...modifiers,
});

describe("isTrashShortcut", () => {
  it("accepts the forward Delete key on every OS", () => {
    expect(isTrashShortcut(press("Delete"), true)).toBe(true);
    expect(isTrashShortcut(press("Delete"), false)).toBe(true);
  });

  it("accepts Cmd+Backspace on macOS, as Finder does", () => {
    expect(isTrashShortcut(press("Backspace", { metaKey: true }), true)).toBe(true);
  });

  it("ignores Ctrl+Backspace on macOS, which Finder does not use", () => {
    expect(isTrashShortcut(press("Backspace", { ctrlKey: true }), true)).toBe(false);
  });

  it("ignores Backspace with any modifier outside macOS, where only Delete moves files to the bin", () => {
    expect(isTrashShortcut(press("Backspace", { ctrlKey: true }), false)).toBe(false);
    expect(isTrashShortcut(press("Backspace", { metaKey: true }), false)).toBe(false);
  });

  it("ignores a plain Backspace so a stray key press cannot start a deletion", () => {
    expect(isTrashShortcut(press("Backspace"), true)).toBe(false);
    expect(isTrashShortcut(press("Backspace"), false)).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isTrashShortcut(press("a", { metaKey: true }), true)).toBe(false);
  });
});

describe("isMacUserAgent", () => {
  it("recognizes the WKWebView user agent on macOS", () => {
    expect(
      isMacUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)",
      ),
    ).toBe(true);
  });

  it("does not take Windows or Linux for macOS", () => {
    expect(
      isMacUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      ),
    ).toBe(false);
    expect(isMacUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15")).toBe(false);
  });
});
