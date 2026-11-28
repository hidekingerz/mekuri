import { describe, expect, it } from "vitest";
import type { DirectoryEntry } from "../types";
import { compareEntries, type FileSort, isFileSort, sortEntries } from "./fileSort";

const entry = (name: string, extra: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  name,
  path: `/x/${name}`,
  is_dir: false,
  is_archive: true,
  is_pdf: false,
  has_subfolders: false,
  ...extra,
});

describe("sortEntries", () => {
  // the backend already returns natural name order; "name" keeps or reverses it
  const list = [
    entry("a.zip", { modified_ms: 300, size: 10 }),
    entry("b.zip", { modified_ms: 100, size: 30 }),
    entry("c.zip", { modified_ms: 200, size: 20 }),
  ];
  const names = (xs: DirectoryEntry[]) => xs.map((e) => e.name);

  it("keeps backend order for name ascending and reverses for descending", () => {
    expect(names(sortEntries(list, "name", "asc"))).toEqual(["a.zip", "b.zip", "c.zip"]);
    expect(names(sortEntries(list, "name", "desc"))).toEqual(["c.zip", "b.zip", "a.zip"]);
  });

  it("sorts by modified time", () => {
    expect(names(sortEntries(list, "modified", "asc"))).toEqual(["b.zip", "c.zip", "a.zip"]);
    expect(names(sortEntries(list, "modified", "desc"))).toEqual(["a.zip", "c.zip", "b.zip"]);
  });

  it("sorts by size", () => {
    expect(names(sortEntries(list, "size", "asc"))).toEqual(["a.zip", "c.zip", "b.zip"]);
  });

  it("puts entries without the value last and does not mutate the input", () => {
    const withMissing = [...list, entry("d.zip")];
    expect(names(sortEntries(withMissing, "size", "asc"))).toEqual([
      "a.zip",
      "c.zip",
      "b.zip",
      "d.zip",
    ]);
    expect(names(withMissing)).toEqual(["a.zip", "b.zip", "c.zip", "d.zip"]);
  });

  it("keeps entries without the value in their original order, after the others, in both directions", () => {
    const mixed = [
      entry("m1.zip"),
      entry("a.zip", { size: 10 }),
      entry("m2.zip"),
      entry("b.zip", { size: 30 }),
      entry("m3.zip"),
      entry("c.zip", { size: 20 }),
    ];
    expect(names(sortEntries(mixed, "size", "asc"))).toEqual([
      "a.zip",
      "c.zip",
      "b.zip",
      "m1.zip",
      "m2.zip",
      "m3.zip",
    ]);
    expect(names(sortEntries(mixed, "size", "desc"))).toEqual([
      "b.zip",
      "c.zip",
      "a.zip",
      "m1.zip",
      "m2.zip",
      "m3.zip",
    ]);
  });
});

describe("compareEntries", () => {
  const sorts: FileSort[] = (["name", "modified", "size"] as const).flatMap((key) =>
    (["asc", "desc"] as const).map((direction) => ({ key, direction })),
  );
  // 名前の自然順（バックエンドが返す順）。同じ値どうしと、値の無いものを混ぜてある
  const natural = [
    entry("v1.zip", { modified_ms: 200, size: 30 }),
    entry("v2.zip", { modified_ms: 100, size: 30 }),
    entry("V3.zip"),
    entry("v10.zip", { modified_ms: 200, size: 10 }),
    entry("v11.zip", { modified_ms: null, size: null }),
    entry("v20.zip", { modified_ms: 300, size: 20 }),
  ];

  it.each(sorts)("agrees with the order sortEntries produces for $key $direction", (sort) => {
    const sorted = sortEntries(natural, sort.key, sort.direction);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = 0; j < sorted.length; j++) {
        // || 0 は、-0 を 0 にそろえるため
        expect(Math.sign(compareEntries(sorted[i], sorted[j], sort)) || 0).toBe(Math.sign(i - j));
      }
    }
  });

  it("orders names by number and ignores case, like the list", () => {
    const sort: FileSort = { key: "name", direction: "asc" };
    expect(compareEntries(entry("v2.zip"), entry("v10.zip"), sort)).toBeLessThan(0);
    expect(compareEntries(entry("V3.zip"), entry("v10.zip"), sort)).toBeLessThan(0);
  });

  it("places a file whose value is unknown after every file that has one", () => {
    const unknown = entry("a.zip");
    for (const direction of ["asc", "desc"] as const) {
      expect(
        compareEntries(unknown, entry("z.zip", { size: 1 }), { key: "size", direction }),
      ).toBeGreaterThan(0);
      expect(
        compareEntries(entry("z.zip", { modified_ms: 1 }), unknown, { key: "modified", direction }),
      ).toBeLessThan(0);
    }
  });
});

describe("isFileSort", () => {
  it("accepts every key and direction the list offers", () => {
    for (const key of ["name", "modified", "size"]) {
      for (const direction of ["asc", "desc"]) {
        expect(isFileSort({ key, direction })).toBe(true);
      }
    }
  });

  it("rejects values another version or a broken settings file may have left", () => {
    expect(isFileSort(undefined)).toBe(false);
    expect(isFileSort(null)).toBe(false);
    expect(isFileSort("name")).toBe(false);
    expect(isFileSort({ key: "created", direction: "asc" })).toBe(false);
    expect(isFileSort({ key: "toString", direction: "asc" })).toBe(false);
    expect(isFileSort({ key: "name", direction: "up" })).toBe(false);
    expect(isFileSort({ key: "name" })).toBe(false);
    expect(isFileSort({ direction: "asc" })).toBe(false);
  });
});
