import { describe, expect, it } from "vitest";
import type { DirectoryEntry, TreeNodeData } from "../types";
import {
  expandPaths,
  getAncestorPaths,
  mergeNodes,
  replaceChildren,
  toggleNode,
  toNodes,
} from "./folderTree";

function dir(path: string, hasSubfolders = false): DirectoryEntry {
  return {
    name: path.slice(path.lastIndexOf("/") + 1),
    path,
    is_dir: true,
    is_archive: false,
    is_pdf: false,
    has_subfolders: hasSubfolders,
  };
}

function node(
  path: string,
  extra: Partial<Omit<TreeNodeData, "entry">> = {},
  hasSubfolders = false,
): TreeNodeData {
  return { entry: dir(path, hasSubfolders), children: null, isOpen: false, ...extra };
}

describe("mergeNodes", () => {
  it("adds entries that are not in the existing nodes as unexpanded nodes", () => {
    const existing = [node("/root/a")];
    const fresh = [dir("/root/a"), dir("/root/b")];
    expect(mergeNodes(existing, fresh)).toEqual([node("/root/a"), node("/root/b")]);
  });

  it("drops nodes whose entry is missing from the fresh list", () => {
    const existing = [node("/root/a"), node("/root/b")];
    expect(mergeNodes(existing, [dir("/root/b")])).toEqual([node("/root/b")]);
  });

  it("keeps isOpen and loaded children of retained nodes but takes the fresh entry", () => {
    const grandchild = node("/root/a/x");
    const existing = [node("/root/a", { isOpen: true, children: [grandchild] })];
    const fresh = [dir("/root/a", true)];
    expect(mergeNodes(existing, fresh)).toEqual([
      { entry: dir("/root/a", true), isOpen: true, children: [grandchild] },
    ]);
  });

  it("orders the result by the fresh list", () => {
    const existing = [node("/root/b"), node("/root/a")];
    const fresh = [dir("/root/a"), dir("/root/b")];
    expect(mergeNodes(existing, fresh).map((n) => n.entry.path)).toEqual(["/root/a", "/root/b"]);
  });
});

describe("replaceChildren", () => {
  it("merges fresh entries into the children of the node at path, preserving grandchildren state", () => {
    const deep = node("/root/a/x/deep");
    const x = node("/root/a/x", { isOpen: true, children: [deep] });
    const y = node("/root/a/y");
    const a = node("/root/a", { isOpen: true, children: [x, y] });
    const nodes = [a, node("/root/b")];

    const result = replaceChildren(nodes, "/root/a", [dir("/root/a/x"), dir("/root/a/z")]);

    expect(result).toEqual([{ ...a, children: [x, node("/root/a/z")] }, node("/root/b")]);
  });

  it("replaces children of a nested node", () => {
    const x = node("/root/a/x", { isOpen: true, children: [] });
    const a = node("/root/a", { isOpen: true, children: [x] });

    const result = replaceChildren([a], "/root/a/x", [dir("/root/a/x/new")]);

    expect(result).toEqual([{ ...a, children: [{ ...x, children: [node("/root/a/x/new")] }] }]);
  });

  it("populates children of a node that was never expanded without opening it", () => {
    const a = node("/root/a");
    const result = replaceChildren([a], "/root/a", [dir("/root/a/x")]);
    expect(result).toEqual([{ ...a, isOpen: false, children: [node("/root/a/x")] }]);
  });

  it("returns the same array when the path is not in the tree", () => {
    const nodes = [node("/root/a")];
    expect(replaceChildren(nodes, "/root/missing", [dir("/root/missing/x")])).toBe(nodes);
  });
});

/** 呼び出されたパスを記録し、あらかじめ用意した子エントリを返す読み込み関数 */
function fakeLoader(tree: Record<string, DirectoryEntry[]>) {
  const calls: string[] = [];
  const load = async (path: string) => {
    calls.push(path);
    const entries = tree[path];
    if (!entries) throw new Error(`no such dir: ${path}`);
    return entries;
  };
  return { load, calls };
}

describe("toNodes", () => {
  it("wraps entries as collapsed, unloaded nodes", () => {
    expect(toNodes([dir("/root/a"), dir("/root/b")])).toEqual([node("/root/a"), node("/root/b")]);
  });
});

describe("getAncestorPaths", () => {
  it("returns an empty list when the target is outside the root", () => {
    expect(getAncestorPaths("/root", "/elsewhere/x")).toEqual([]);
  });

  it("returns an empty list for a direct child (nothing needs expanding)", () => {
    expect(getAncestorPaths("/root", "/root/a")).toEqual([]);
  });

  it("returns each ancestor between the root and the target, excluding the target", () => {
    expect(getAncestorPaths("/root", "/root/a/b/c")).toEqual(["/root/a", "/root/a/b"]);
  });
});

describe("toggleNode", () => {
  it("opens a collapsed node and loads its children exactly once", async () => {
    const { load, calls } = fakeLoader({ "/root/a": [dir("/root/a/x")] });
    const result = await toggleNode([node("/root/a")], "/root/a", load);
    expect(result).toEqual([node("/root/a", { isOpen: true, children: [node("/root/a/x")] })]);
    expect(calls).toEqual(["/root/a"]);
  });

  it("closes an open node without reloading", async () => {
    const { load, calls } = fakeLoader({});
    const open = node("/root/a", { isOpen: true, children: [node("/root/a/x")] });
    const result = await toggleNode([open], "/root/a", load);
    expect(result).toEqual([{ ...open, isOpen: false }]);
    expect(calls).toEqual([]);
  });

  it("reopens a node using its already loaded children", async () => {
    const { load, calls } = fakeLoader({});
    const closed = node("/root/a", { isOpen: false, children: [node("/root/a/x")] });
    const result = await toggleNode([closed], "/root/a", load);
    expect(result).toEqual([{ ...closed, isOpen: true }]);
    expect(calls).toEqual([]);
  });

  it("treats a failed load as an empty folder", async () => {
    const { load } = fakeLoader({});
    const result = await toggleNode([node("/root/a")], "/root/a", load);
    expect(result).toEqual([node("/root/a", { isOpen: true, children: [] })]);
  });

  it("toggles a nested node inside an open parent", async () => {
    const { load } = fakeLoader({ "/root/a/x": [dir("/root/a/x/deep")] });
    const a = node("/root/a", { isOpen: true, children: [node("/root/a/x")] });
    const result = await toggleNode([a], "/root/a/x", load);
    expect(result).toEqual([
      { ...a, children: [node("/root/a/x", { isOpen: true, children: [node("/root/a/x/deep")] })] },
    ]);
  });
});

describe("expandPaths", () => {
  it("opens every listed path, loading children as needed, and leaves others untouched", async () => {
    const { load, calls } = fakeLoader({
      "/root/a": [dir("/root/a/b")],
      "/root/a/b": [dir("/root/a/b/c")],
    });
    const nodes = [node("/root/a"), node("/root/z")];
    const result = await expandPaths(nodes, new Set(["/root/a", "/root/a/b"]), load);
    expect(result).toEqual([
      node("/root/a", {
        isOpen: true,
        children: [node("/root/a/b", { isOpen: true, children: [node("/root/a/b/c")] })],
      }),
      node("/root/z"),
    ]);
    expect(calls).toEqual(["/root/a", "/root/a/b"]);
  });

  it("does not reload children that are already loaded", async () => {
    const { load, calls } = fakeLoader({});
    const a = node("/root/a", { isOpen: false, children: [node("/root/a/b")] });
    const result = await expandPaths([a], new Set(["/root/a"]), load);
    expect(result).toEqual([{ ...a, isOpen: true }]);
    expect(calls).toEqual([]);
  });
});
