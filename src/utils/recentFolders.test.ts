import { describe, expect, it } from "vitest";
import {
  formatOpenedAt,
  parseRecentFolders,
  type RecentFolder,
  recordOpen,
  resolveRecentFolders,
} from "./recentFolders";

const at = (iso: string) => new Date(iso).getTime();

describe("recordOpen", () => {
  it("adds the folder containing the opened file to the front", () => {
    const list = recordOpen([], "/m/A/vol1.zip", 100);
    expect(list).toEqual([{ folder: "/m/A", file: "/m/A/vol1.zip", openedAt: 100 }]);
  });

  it("moves a folder opened again to the front and updates its file and time", () => {
    const list: RecentFolder[] = [
      { folder: "/m/B", file: "/m/B/x.zip", openedAt: 2 },
      { folder: "/m/A", file: "/m/A/vol1.zip", openedAt: 1 },
    ];
    expect(recordOpen(list, "/m/A/vol2.zip", 3)).toEqual([
      { folder: "/m/A", file: "/m/A/vol2.zip", openedAt: 3 },
      { folder: "/m/B", file: "/m/B/x.zip", openedAt: 2 },
    ]);
  });

  it("keeps only the newest entries up to the limit", () => {
    let list: RecentFolder[] = [];
    for (let i = 0; i <= 10; i++) list = recordOpen(list, `/m/${i}/a.zip`, i);
    expect(list).toHaveLength(10);
    expect(list[0].folder).toBe("/m/10");
    expect(list[list.length - 1].folder).toBe("/m/1");
  });

  it("ignores a path without a parent folder", () => {
    expect(recordOpen([], "vol1.zip", 1)).toEqual([]);
  });
});

describe("parseRecentFolders", () => {
  it("keeps well-formed entries and drops the rest", () => {
    const good = { folder: "/m/A", file: "/m/A/a.zip", openedAt: 1 };
    expect(parseRecentFolders([good, { folder: 1 }, null, "x"])).toEqual([good]);
  });

  it("drops an entry when any one field has the wrong type", () => {
    const entries = [
      { folder: 1, file: "/m/A/a.zip", openedAt: 1 },
      { folder: "/m/A", file: 1, openedAt: 1 },
      { folder: "/m/A", file: "/m/A/a.zip", openedAt: "1" },
    ];
    expect(parseRecentFolders(entries)).toEqual([]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseRecentFolders(undefined)).toEqual([]);
    expect(parseRecentFolders({})).toEqual([]);
  });
});

describe("resolveRecentFolders", () => {
  const list: RecentFolder[] = [
    { folder: "/m/manga/A/done/X", file: "/m/manga/A/done/X/vol3.zip", openedAt: 3 },
    { folder: "/m/mag", file: "/m/mag/oct.pdf", openedAt: 2 },
    { folder: "/elsewhere/Z", file: "/elsewhere/Z/z.zip", openedAt: 1 },
  ];
  const favorites = ["/m/manga", "/m/mag"];
  const allExist = () => true;

  it("attaches the favorite each folder belongs to and a short location", () => {
    expect(resolveRecentFolders(list, favorites, null, allExist)).toEqual([
      {
        folder: "/m/manga/A/done/X",
        file: "/m/manga/A/done/X/vol3.zip",
        openedAt: 3,
        favorite: "/m/manga",
        name: "X",
        fileName: "vol3.zip",
        location: ["manga", "A", "done", "X"],
      },
      {
        folder: "/m/mag",
        file: "/m/mag/oct.pdf",
        openedAt: 2,
        favorite: "/m/mag",
        name: "mag",
        fileName: "oct.pdf",
        location: ["mag"],
      },
    ]);
  });

  it("does not mistake a sibling with a common prefix for a favorite's child", () => {
    const entry = { folder: "/m/manga2/B", file: "/m/manga2/B/b.zip", openedAt: 1 };
    expect(resolveRecentFolders([entry], favorites, null, allExist)).toEqual([]);
  });

  it("uses the deepest favorite when favorites are nested", () => {
    const [entry] = resolveRecentFolders(list, ["/m", "/m/manga"], null, allExist);
    expect(entry.favorite).toBe("/m/manga");
    const [reversed] = resolveRecentFolders(list, ["/m/manga", "/m"], null, allExist);
    expect(reversed.favorite).toBe("/m/manga");
  });

  it("leaves out the folder being shown and folders that no longer exist", () => {
    const resolved = resolveRecentFolders(
      list,
      favorites,
      "/m/mag",
      (p) => p !== "/m/manga/A/done/X",
    );
    expect(resolved).toEqual([]);
  });
});

describe("formatOpenedAt", () => {
  const now = at("2026-11-21T12:00:00");

  it("says today for the same calendar day", () => {
    expect(formatOpenedAt(at("2026-11-21T00:10:00"), now)).toBe("今日");
  });

  it("says yesterday for the previous calendar day, even under 24 hours ago", () => {
    expect(formatOpenedAt(at("2026-11-20T23:50:00"), now)).toBe("昨日");
  });

  it("counts days for the last week", () => {
    expect(formatOpenedAt(at("2026-11-18T09:00:00"), now)).toBe("3 日前");
    expect(formatOpenedAt(at("2026-11-15T09:00:00"), now)).toBe("6 日前");
  });

  it("shows the date from a week ago on", () => {
    expect(formatOpenedAt(at("2026-11-14T09:00:00"), now)).toBe("11月14日");
  });

  it("counts calendar days across a month boundary", () => {
    expect(formatOpenedAt(at("2026-11-30T22:00:00"), at("2026-12-01T08:00:00"))).toBe("昨日");
    expect(formatOpenedAt(at("2026-10-29T12:00:00"), at("2026-11-02T12:00:00"))).toBe("4 日前");
  });

  it("counts calendar days across a year boundary without adding the year", () => {
    expect(formatOpenedAt(at("2026-12-31T23:00:00"), at("2027-01-01T01:00:00"))).toBe("昨日");
  });

  it("adds the year for an earlier year", () => {
    expect(formatOpenedAt(at("2025-12-30T09:00:00"), now)).toBe("2025年12月30日");
  });
});

describe("Windows paths", () => {
  it("records the folder of a file whose path uses backslashes", () => {
    expect(recordOpen([], "C:\\manga\\作者A\\a1.zip", 1)).toEqual([
      { folder: "C:\\manga\\作者A", file: "C:\\manga\\作者A\\a1.zip", openedAt: 1 },
    ]);
  });

  it("resolves the favorite, the names and the location", () => {
    const list = [
      { folder: "C:\\manga\\作者A\\完結", file: "C:\\manga\\作者A\\完結\\k1.zip", openedAt: 1 },
    ];
    expect(resolveRecentFolders(list, ["C:\\manga", "D:\\other"], null, () => true)).toEqual([
      {
        ...list[0],
        favorite: "C:\\manga",
        name: "完結",
        fileName: "k1.zip",
        location: ["manga", "作者A", "完結"],
      },
    ]);
  });
});

describe("favorites that only share the start of a name", () => {
  it("does not put a folder under a favorite whose name is a prefix of its own", () => {
    const list = [{ folder: "/m/manga2/x", file: "/m/manga2/x/a.zip", openedAt: 1 }];
    expect(resolveRecentFolders(list, ["/m/manga"], null, () => true)).toEqual([]);
  });
});
