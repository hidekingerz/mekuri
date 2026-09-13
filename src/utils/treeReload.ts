import type { DirectoryEntry, TreeNodeData } from "../types";

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
 * path が見つからなければ入力配列をそのまま返す。
 */
export function replaceChildren(
  nodes: TreeNodeData[],
  path: string,
  fresh: DirectoryEntry[],
): TreeNodeData[] {
  let changed = false;
  const result = nodes.map((node) => {
    if (node.entry.path === path) {
      changed = true;
      return { ...node, children: mergeNodes(node.children ?? [], fresh) };
    }
    if (node.children) {
      const children = replaceChildren(node.children, path, fresh);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? result : nodes;
}
