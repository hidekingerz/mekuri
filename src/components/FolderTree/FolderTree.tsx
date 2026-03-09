import { useCallback, useEffect, useState } from "react";
import { readDirectoryFolders } from "../../api/directory";
import { addFavorite } from "../../api/favorites";
import { useContextMenu } from "../../hooks/useContextMenu";
import type { DirectoryEntry, TreeNodeData } from "../../types";
import { errorToString } from "../../utils/errorToString";
import { FolderIcon } from "../Icons/Icons";
import { TreeNode } from "./TreeNode";

type FolderTreeProps = {
  rootPath: string;
  selectedPath: string | null;
  onFolderSelect: (path: string) => void;
  onFavoriteAdded?: () => void;
  searchFolders: DirectoryEntry[] | null;
  revealPath: string | null;
  onRevealComplete: () => void;
};

// rootPath から targetPath までの各階層のパスを返す
function getAncestorPaths(rootPath: string, targetPath: string): string[] {
  if (!targetPath.startsWith(rootPath)) return [];
  const relative = targetPath.slice(rootPath.length);
  const segments = relative.split("/").filter(Boolean);
  const paths: string[] = [];
  let current = rootPath;
  // 最後のセグメント（targetPath自身）は展開不要なので除外
  for (let i = 0; i < segments.length - 1; i++) {
    current = `${current}/${segments[i]}`;
    paths.push(current);
  }
  return paths;
}

// ツリーノードを再帰的に展開する
async function expandPaths(
  nodes: TreeNodeData[],
  pathsToExpand: Set<string>,
): Promise<TreeNodeData[]> {
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    if (pathsToExpand.has(node.entry.path)) {
      let children = node.children;
      if (children === null) {
        try {
          const entries = await readDirectoryFolders(node.entry.path);
          children = entries.map((entry) => ({
            entry,
            children: null,
            isOpen: false,
          }));
        } catch {
          children = [];
        }
      }
      const expandedChildren = await expandPaths(children, pathsToExpand);
      result.push({ ...node, isOpen: true, children: expandedChildren });
    } else if (node.children && node.isOpen) {
      result.push({
        ...node,
        children: await expandPaths(node.children, pathsToExpand),
      });
    } else {
      result.push(node);
    }
  }
  return result;
}

export function FolderTree({
  rootPath,
  selectedPath,
  onFolderSelect,
  onFavoriteAdded,
  searchFolders,
  revealPath,
  onRevealComplete,
}: FolderTreeProps) {
  const [nodes, setNodes] = useState<TreeNodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  const loadRoot = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await readDirectoryFolders(rootPath);
      setNodes(entries.map((entry) => ({ entry, children: null, isOpen: false })));
      setLoaded(true);
    } catch (err) {
      setError(errorToString(err));
    } finally {
      setLoading(false);
    }
  }, [rootPath, loaded]);

  useEffect(() => {
    if (!loaded && !loading) {
      loadRoot();
    }
  }, [loaded, loading, loadRoot]);

  const [prevRoot, setPrevRoot] = useState(rootPath);
  if (prevRoot !== rootPath) {
    setPrevRoot(rootPath);
    setNodes([]);
    setLoaded(false);
    setError(null);
  }

  // revealPath が設定されたらツリーを自動展開
  useEffect(() => {
    if (!revealPath || !loaded) return;

    const ancestors = getAncestorPaths(rootPath, revealPath);
    if (ancestors.length === 0) {
      onRevealComplete();
      return;
    }

    const pathsToExpand = new Set(ancestors);
    setNodes((prev) => {
      expandPaths(prev, pathsToExpand).then((expanded) => {
        setNodes(expanded);
        onRevealComplete();
      });
      return prev;
    });
  }, [revealPath, loaded, rootPath, onRevealComplete]);

  const toggleNode = useCallback(async (path: string) => {
    const toggle = async (items: TreeNodeData[]): Promise<TreeNodeData[]> => {
      const result: TreeNodeData[] = [];
      for (const node of items) {
        if (node.entry.path === path) {
          if (node.isOpen) {
            result.push({ ...node, isOpen: false });
          } else {
            let children = node.children;
            if (children === null) {
              try {
                const entries = await readDirectoryFolders(path);
                children = entries.map((entry) => ({
                  entry,
                  children: null,
                  isOpen: false,
                }));
              } catch {
                children = [];
              }
            }
            result.push({ ...node, isOpen: true, children });
          }
        } else if (node.children && node.isOpen) {
          result.push({
            ...node,
            children: await toggle(node.children),
          });
        } else {
          result.push(node);
        }
      }
      return result;
    };

    setNodes((prev) => {
      toggle(prev).then(setNodes);
      return prev;
    });
  }, []);

  const handleAddFavorite = useCallback(async () => {
    if (contextMenu) {
      await addFavorite(contextMenu.path);
      closeContextMenu();
      onFavoriteAdded?.();
    }
  }, [contextMenu, closeContextMenu, onFavoriteAdded]);

  // 検索中はフラットリストで表示
  if (searchFolders !== null) {
    if (searchFolders.length === 0) {
      return <div className="folder-tree-loading">No folders found</div>;
    }
    return (
      <div className="folder-tree">
        {searchFolders.map((folder) => (
          <div
            key={folder.path}
            className={`tree-node tree-node--folder ${folder.path === selectedPath ? "tree-node--selected" : ""}`}
            style={{ paddingLeft: "8px" }}
            onClick={() => onFolderSelect(folder.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFolderSelect(folder.path);
              }
            }}
            role="treeitem"
            tabIndex={0}
          >
            <span className="tree-node__icon">
              <FolderIcon size={16} />
            </span>
            <span className="tree-node__name">{folder.name}</span>
          </div>
        ))}
      </div>
    );
  }

  if (loading && nodes.length === 0) {
    return <div className="folder-tree-loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="folder-tree-error">
        <p>Failed to read directory</p>
        <p className="folder-tree-error__detail">{error}</p>
      </div>
    );
  }

  return (
    <div className="folder-tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.entry.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onToggle={toggleNode}
          onSelect={onFolderSelect}
          onContextMenu={openContextMenu}
        />
      ))}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" className="context-menu__item" onClick={handleAddFavorite}>
            Add to favorites
          </button>
        </div>
      )}
    </div>
  );
}
