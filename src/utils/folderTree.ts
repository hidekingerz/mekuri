import type { DirectoryEntry, TreeNodeData } from "../types";
import { isSameOrInside, joinPath, parentPath, segmentsBelow } from "./paths";

/**
 * 既存ノード配列と再取得したエントリをマージする。
 * 残るノードは展開状態と読み込み済みの子を維持しつつエントリだけ更新し、
 * 消えたノードは削除、増えたノードは未展開で追加する。順序は fresh に従う。
 */
export function mergeNodes(existing: TreeNodeData[], fresh: DirectoryEntry[]): TreeNodeData[] {
  const byPath = new Map(existing.map((node) => [node.entry.path, node]));
  return fresh.map((entry) => {
    const prev = byPath.get(entry.path);
    return prev ? { ...prev, entry } : { entry, children: null, isOpen: false };
  });
}

/**
 * ツリー内の path のノードの children を fresh とのマージ結果に置き換える。
 * サブフォルダの有無（シェブロンを出すか）も fresh に合わせ、無くなったら閉じる。
 * path が見つからなければ入力配列をそのまま返す。
 */
export function replaceChildren(
  nodes: TreeNodeData[],
  path: string,
  fresh: DirectoryEntry[],
): TreeNodeData[] {
  return updateNode(nodes, path, (node) => ({
    entry: { ...node.entry, has_subfolders: fresh.length > 0 },
    children: mergeNodes(node.children ?? [], fresh),
    isOpen: node.isOpen && fresh.length > 0,
  }));
}

/** path のノードを開く・閉じる。path が見つからなければ入力配列をそのまま返す。 */
export function setNodeOpen(nodes: TreeNodeData[], path: string, isOpen: boolean): TreeNodeData[] {
  return updateNode(nodes, path, (node) => (node.isOpen === isOpen ? node : { ...node, isOpen }));
}

/** path のノード。読み込んだ範囲に無ければ null。 */
export function findNode(nodes: TreeNodeData[], path: string): TreeNodeData | null {
  for (const node of nodes) {
    if (node.entry.path === path) return node;
    const found = node.children && findNode(node.children, path);
    if (found) return found;
  }
  return null;
}

/** path のノードを update の結果に置き換える。変わらなければ入力配列をそのまま返す。 */
function updateNode(
  nodes: TreeNodeData[],
  path: string,
  update: (node: TreeNodeData) => TreeNodeData,
): TreeNodeData[] {
  let changed = false;
  const result = nodes.map((node) => {
    if (node.entry.path === path) {
      const updated = update(node);
      if (updated !== node) changed = true;
      return updated;
    }
    if (node.children) {
      const children = updateNode(node.children, path, update);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? result : nodes;
}

/**
 * rootPath から targetPath までの各階層のパスを返す (targetPath 自身は含まない)。
 * targetPath が rootPath 配下でなければ空配列。
 */
export function getAncestorPaths(rootPath: string, targetPath: string): string[] {
  const segments = segmentsBelow(rootPath, targetPath) ?? [];
  const paths: string[] = [];
  let current = rootPath;
  for (const segment of segments.slice(0, -1)) {
    current = joinPath(current, segment);
    paths.push(current);
  }
  return paths;
}

/** root から path の親までの相対パス（例: "a/b"）。直下や root の外なら空文字。 */
export function relativeParent(rootPath: string, targetPath: string): string {
  return (segmentsBelow(rootPath, targetPath) ?? []).slice(0, -1).join("/");
}

/** ツリーから path のノードを取り除く。親の子が空になったら、親を閉じて展開マークも消す。 */
export function removeNode(nodes: TreeNodeData[], path: string): TreeNodeData[] {
  let changed = false;
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    if (node.entry.path === path) {
      changed = true;
      continue;
    }
    if (node.children) {
      const children = removeNode(node.children, path);
      if (children !== node.children) {
        changed = true;
        result.push(
          children.length === 0
            ? { entry: { ...node.entry, has_subfolders: false }, children, isOpen: false }
            : { ...node, children },
        );
        continue;
      }
    }
    result.push(node);
  }
  return changed ? result : nodes;
}

/**
 * フォルダを消したあとの選択先。消したフォルダかその中を選んでいたら親へ移し、
 * 親がお気に入りのルートなら選択を外す。
 */
export function selectionAfterRemoval(
  selected: string | null,
  removed: string,
  rootPath: string,
): string | null {
  if (selected === null) return null;
  if (!isSameOrInside(removed, selected)) return selected;
  const parent = parentPath(removed);
  return parent === null || parent === rootPath ? null : parent;
}
