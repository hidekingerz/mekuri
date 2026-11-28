import { describe, expect, it } from "vitest";
import { rangeBetween, retainInSet, toggleInSet } from "./selection";

describe("toggleInSet", () => {
  it("adds an item that is not selected", () => {
    expect(toggleInSet(new Set(), "a")).toEqual(new Set(["a"]));
  });

  it("removes an item that is already selected", () => {
    expect(toggleInSet(new Set(["a", "b"]), "a")).toEqual(new Set(["b"]));
  });

  it("does not mutate the input set", () => {
    const input = new Set(["a"]);
    toggleInSet(input, "b");
    expect(input).toEqual(new Set(["a"]));
  });
});

describe("rangeBetween", () => {
  const order = ["a", "b", "c", "d", "e"];

  it("returns items between anchor and target inclusive", () => {
    expect(rangeBetween(order, "b", "d")).toEqual(["b", "c", "d"]);
  });

  it("works when target precedes anchor", () => {
    expect(rangeBetween(order, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("returns only the target when anchor is missing from order", () => {
    expect(rangeBetween(order, "zzz", "c")).toEqual(["c"]);
  });

  it("returns only the target when the target is missing from order", () => {
    expect(rangeBetween(order, "b", "zzz")).toEqual(["zzz"]);
  });

  it("returns only the target when anchor is null", () => {
    expect(rangeBetween(order, null, "c")).toEqual(["c"]);
  });
});

describe("retainInSet", () => {
  it("drops items that are not in the list to keep", () => {
    expect(retainInSet(new Set(["a", "b", "c"]), ["c", "a", "x"])).toEqual(new Set(["a", "c"]));
  });

  it("returns the same set when nothing is dropped", () => {
    const set = new Set(["a", "b"]);
    expect(retainInSet(set, ["b", "a", "c"])).toBe(set);
  });

  it("empties the set when nothing is kept", () => {
    expect(retainInSet(new Set(["a"]), [])).toEqual(new Set());
  });
});
