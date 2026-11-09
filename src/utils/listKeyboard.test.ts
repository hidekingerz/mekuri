import { describe, expect, it } from "vitest";
import { moveListIndex } from "./listKeyboard";

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
