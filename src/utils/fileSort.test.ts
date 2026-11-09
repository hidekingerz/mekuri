import { describe, expect, it } from "vitest";
import type { DirectoryEntry } from "../types";
import { sortEntries } from "./fileSort";

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
});
