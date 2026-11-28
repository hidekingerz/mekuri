import { describe, expect, it } from "vitest";
import type { DirectoryEntry, TreeNodeData } from "../types";
import {
  findNode,
  getAncestorPaths,
  mergeNodes,
  relativeParent,
  removeNode,
  replaceChildren,
  selectionAfterRemoval,
  setNodeOpen,
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
  const withSubfolders = (n: TreeNodeData, has: boolean): TreeNodeData => ({
    ...n,
    entry: { ...n.entry, has_subfolders: has },
  });

  it("merges fresh entries into the children of the node at path, preserving grandchildren state", () => {
    const deep = node("/root/a/x/deep");
    const x = node("/root/a/x", { isOpen: true, children: [deep] });
    const y = node("/root/a/y");
    const a = node("/root/a", { isOpen: true, children: [x, y] }, true);
    const nodes = [a, node("/root/b")];

    const result = replaceChildren(nodes, "/root/a", [dir("/root/a/x"), dir("/root/a/z")]);

    expect(result).toEqual([{ ...a, children: [x, node("/root/a/z")] }, node("/root/b")]);
  });

  it("replaces children of a nested node", () => {
    const x = node("/root/a/x", { isOpen: true, children: [] });
    const a = node("/root/a", { isOpen: true, children: [x] });

    const result = replaceChildren([a], "/root/a/x", [dir("/root/a/x/new")]);

    expect(result).toEqual([
      { ...a, children: [withSubfolders({ ...x, children: [node("/root/a/x/new")] }, true)] },
    ]);
  });

  it("populates children of a node that was never expanded without opening it", () => {
    const a = node("/root/a", {}, true);
    const result = replaceChildren([a], "/root/a", [dir("/root/a/x")]);
    expect(result).toEqual([{ ...a, isOpen: false, children: [node("/root/a/x")] }]);
  });

  it("shows the chevron once a folder gained its first subfolder", () => {
    const a = node("/root/a", {}, false);
    const [result] = replaceChildren([a], "/root/a", [dir("/root/a/new")]);
    expect(result.entry.has_subfolders).toBe(true);
  });

  it("drops the chevron and closes a folder whose subfolders are all gone", () => {
    const a = node("/root/a", { isOpen: true, children: [node("/root/a/x")] }, true);
    const [result] = replaceChildren([a], "/root/a", []);
    expect(result).toEqual(withSubfolders({ ...a, isOpen: false, children: [] }, false));
  });

  it("returns the same array when the path is not in the tree", () => {
    const nodes = [node("/root/a")];
    expect(replaceChildren(nodes, "/root/missing", [dir("/root/missing/x")])).toBe(nodes);
  });

  it("keeps untouched branches as the same objects", () => {
    const untouched = node("/root/b", { isOpen: true, children: [node("/root/b/y")] });
    const a = node("/root/a", { isOpen: true, children: [node("/root/a/x")] });
    const result = replaceChildren([a, untouched], "/root/a/x", [dir("/root/a/x/new")]);
    expect(result[1]).toBe(untouched);
  });
});

describe("setNodeOpen", () => {
  it("opens and closes the node at path, keeping its children", () => {
    const a = node("/root/a", { children: [node("/root/a/x")] });
    const opened = setNodeOpen([a, node("/root/b")], "/root/a", true);
    expect(opened).toEqual([{ ...a, isOpen: true }, node("/root/b")]);
    expect(setNodeOpen(opened, "/root/a", false)).toEqual([a, node("/root/b")]);
  });

  it("reaches a nested node, even inside a closed parent", () => {
    const x = node("/root/a/x", { children: [] });
    const a = node("/root/a", { isOpen: false, children: [x] });
    expect(setNodeOpen([a], "/root/a/x", true)).toEqual([
      { ...a, children: [{ ...x, isOpen: true }] },
    ]);
  });

  it("returns the same array when nothing changes", () => {
    const nodes = [node("/root/a", { isOpen: true, children: [] })];
    expect(setNodeOpen(nodes, "/root/a", true)).toBe(nodes);
    expect(setNodeOpen(nodes, "/root/missing", true)).toBe(nodes);
  });
});

describe("findNode", () => {
  const x = node("/root/a/x");
  const a = node("/root/a", { isOpen: false, children: [x] });

  it("finds a node at any loaded depth", () => {
    expect(findNode([a, node("/root/b")], "/root/a")).toBe(a);
    expect(findNode([a, node("/root/b")], "/root/a/x")).toBe(x);
  });

  it("returns null for a path that is not loaded", () => {
    expect(findNode([a], "/root/a/x/deep")).toBeNull();
    expect(findNode([], "/root/a")).toBeNull();
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

  it("does not take a folder that only shares the start of the root's name for a folder inside it", () => {
    expect(getAncestorPaths("/m/manga", "/m/manga2/x/y")).toEqual([]);
  });

  it("works with backslash separators", () => {
    expect(getAncestorPaths("C:\\manga", "C:\\manga\\作者A\\完結\\X")).toEqual([
      "C:\\manga\\作者A",
      "C:\\manga\\作者A\\完結",
    ]);
  });
});

describe("relativeParent", () => {
  it("returns the parent folders between the root and the path", () => {
    expect(relativeParent("/root", "/root/a/b/target")).toBe("a/b");
  });

  it("returns an empty string for a direct child of the root", () => {
    expect(relativeParent("/root", "/root/target")).toBe("");
  });

  it("returns an empty string when the path is outside the root", () => {
    expect(relativeParent("/root", "/other/a/target")).toBe("");
  });

  it("works with backslash separators", () => {
    expect(relativeParent("C:\\manga", "C:\\manga\\作者A\\完結\\X")).toBe("作者A/完結");
  });
});

describe("removeNode", () => {
  it("removes a top-level node", () => {
    expect(removeNode([node("/root/a"), node("/root/b")], "/root/a")).toEqual([node("/root/b")]);
  });

  it("removes a nested node and collapses the parent when it has no subfolders left", () => {
    const tree = [node("/root/a", { isOpen: true, children: [node("/root/a/x")] }, true)];
    expect(removeNode(tree, "/root/a/x")).toEqual([
      node("/root/a", { isOpen: false, children: [] }, false),
    ]);
  });

  it("keeps the parent open when other subfolders remain", () => {
    const a = node(
      "/root/a",
      { isOpen: true, children: [node("/root/a/x"), node("/root/a/y")] },
      true,
    );
    expect(removeNode([a], "/root/a/x")).toEqual([{ ...a, children: [node("/root/a/y")] }]);
  });

  it("returns the same array when the path is not in the tree", () => {
    const tree = [node("/root/a")];
    expect(removeNode(tree, "/root/zzz")).toBe(tree);
  });

  it("keeps untouched branches as the same objects", () => {
    const untouched = node("/root/b", { isOpen: true, children: [node("/root/b/y")] });
    const a = node("/root/a", { isOpen: true, children: [node("/root/a/x"), node("/root/a/z")] });
    const result = removeNode([a, untouched], "/root/a/x");
    expect(result[1]).toBe(untouched);
  });
});

describe("selectionAfterRemoval", () => {
  it("moves the selection to the removed folder's parent", () => {
    expect(selectionAfterRemoval("/root/a/x", "/root/a/x", "/root")).toBe("/root/a");
  });

  it("moves a selection inside the removed folder to its parent", () => {
    expect(selectionAfterRemoval("/root/a/x/y", "/root/a/x", "/root")).toBe("/root/a");
  });

  it("clears the selection when the parent is the favorite root", () => {
    expect(selectionAfterRemoval("/root/a", "/root/a", "/root")).toBeNull();
  });

  it("clears the selection when the removed folder sits at the top of the file system", () => {
    expect(selectionAfterRemoval("/a", "/a", "/root")).toBeNull();
  });

  it("keeps an unrelated selection, including a sibling with a shared prefix", () => {
    expect(selectionAfterRemoval("/root/ab", "/root/a", "/root")).toBe("/root/ab");
    expect(selectionAfterRemoval(null, "/root/a", "/root")).toBeNull();
  });
});

describe("selectionAfterRemoval with other path shapes", () => {
  it("moves the selection to the parent for backslash paths", () => {
    expect(
      selectionAfterRemoval("C:\\manga\\作者A\\完結\\X", "C:\\manga\\作者A\\完結", "C:\\manga"),
    ).toBe("C:\\manga\\作者A");
    expect(selectionAfterRemoval("C:\\manga\\作者A", "C:\\manga\\作者A", "C:\\manga")).toBeNull();
  });

  it("keeps a selection that only shares the start of the removed folder's name", () => {
    expect(selectionAfterRemoval("/m/manga/作者AB", "/m/manga/作者A", "/m/manga")).toBe(
      "/m/manga/作者AB",
    );
  });
});
