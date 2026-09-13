import { describe, expect, it } from "vitest";
import type { DirectoryEntry, TreeNodeData } from "../types";
import { mergeNodes, replaceChildren } from "./treeReload";

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
