import { describe, expect, it } from "vitest";
import { isListKeySource, moveListIndex } from "./listKeyboard";

describe("moveListIndex", () => {
  it("moves down and up by one", () => {
    expect(moveListIndex(5, 1, "ArrowDown")).toBe(2);
    expect(moveListIndex(5, 1, "ArrowUp")).toBe(0);
  });

  it("starts at the first item when nothing is focused yet", () => {
    expect(moveListIndex(5, -1, "ArrowDown")).toBe(0);
    expect(moveListIndex(5, -1, "ArrowUp")).toBe(0);
  });

  it("stops at the ends", () => {
    expect(moveListIndex(5, 4, "ArrowDown")).toBe(4);
    expect(moveListIndex(5, 0, "ArrowUp")).toBe(0);
  });

  it("jumps with Home and End", () => {
    expect(moveListIndex(5, 2, "Home")).toBe(0);
    expect(moveListIndex(5, 2, "End")).toBe(4);
  });

  it("returns null for keys it does not handle and for empty lists", () => {
    expect(moveListIndex(5, 2, "a")).toBeNull();
    expect(moveListIndex(0, -1, "ArrowDown")).toBeNull();
  });
});

/** closest() だけを持つ要素の代わり。祖先に data-path を持つ項目があるかを渡す */
function fakeTarget(insideItem: boolean) {
  return { closest: (selector: string) => (insideItem && selector === "[data-path]" ? {} : null) };
}

describe("isListKeySource", () => {
  it("handles keys pressed on the list container itself", () => {
    const container = fakeTarget(false);
    expect(isListKeySource(container, container)).toBe(true);
  });

  it("handles keys pressed on a file item", () => {
    expect(isListKeySource(fakeTarget(true), fakeTarget(false))).toBe(true);
  });

  it("ignores keys from other controls inside the list, such as the confirm dialog buttons", () => {
    expect(isListKeySource(fakeTarget(false), fakeTarget(false))).toBe(false);
  });
});
