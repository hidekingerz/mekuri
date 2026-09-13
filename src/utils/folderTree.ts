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

/** 子フォルダを読み込む関数。Tauri の IPC はコンポーネント側で注入する。 */
export type LoadChildren = (path: string) => Promise<DirectoryEntry[]>;

/** エントリ配列を未展開・未読み込みのノードにする。 */
export function toNodes(entries: DirectoryEntry[]): TreeNodeData[] {
  return entries.map((entry) => ({ entry, children: null, isOpen: false }));
}

/**
 * rootPath から targetPath までの各階層のパスを返す (targetPath 自身は含まない)。
 * targetPath が rootPath 配下でなければ空配列。
 */
export function getAncestorPaths(rootPath: string, targetPath: string): string[] {
  if (!targetPath.startsWith(rootPath)) return [];
  const segments = targetPath.slice(rootPath.length).split("/").filter(Boolean);
  const paths: string[] = [];
  let current = rootPath;
  for (const segment of segments.slice(0, -1)) {
    current = `${current}/${segment}`;
    paths.push(current);
  }
  return paths;
}

/** 未読み込みなら子を読み込む。失敗は空フォルダとして扱う。 */
async function ensureChildren(node: TreeNodeData, load: LoadChildren): Promise<TreeNodeData[]> {
  if (node.children !== null) return node.children;
  try {
    return toNodes(await load(node.entry.path));
  } catch {
    return [];
  }
}

/** path のノードを開閉する。開くときに子が未読み込みなら load で取得する。 */
export async function toggleNode(
  nodes: TreeNodeData[],
  path: string,
  load: LoadChildren,
): Promise<TreeNodeData[]> {
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    if (node.entry.path === path) {
      if (node.isOpen) {
        result.push({ ...node, isOpen: false });
      } else {
        result.push({ ...node, isOpen: true, children: await ensureChildren(node, load) });
      }
    } else if (node.children && node.isOpen) {
      result.push({ ...node, children: await toggleNode(node.children, path, load) });
    } else {
      result.push(node);
    }
  }
  return result;
}

/** pathsToExpand に含まれるノードを再帰的に開く。子が未読み込みなら load で取得する。 */
export async function expandPaths(
  nodes: TreeNodeData[],
  pathsToExpand: Set<string>,
  load: LoadChildren,
): Promise<TreeNodeData[]> {
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    if (pathsToExpand.has(node.entry.path)) {
      const children = await ensureChildren(node, load);
      result.push({
        ...node,
        isOpen: true,
        children: await expandPaths(children, pathsToExpand, load),
      });
    } else if (node.children && node.isOpen) {
      result.push({ ...node, children: await expandPaths(node.children, pathsToExpand, load) });
    } else {
      result.push(node);
    }
  }
  return result;
}
