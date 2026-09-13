import { useCallback, useEffect, useState } from "react";
import { readDirectoryFolders } from "../../api/directory";
import { addFavorite } from "../../api/favorites";
import { useContextMenu } from "../../hooks/useContextMenu";
import type { DirectoryEntry, TreeNodeData } from "../../types";
import { errorToString } from "../../utils/errorToString";
import {
  expandPaths,
  getAncestorPaths,
  mergeNodes,
  replaceChildren,
  toggleNode as toggleTreeNode,
  toNodes,
} from "../../utils/folderTree";
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
  onFileDrop: (srcPaths: string[], destDir: string) => void;
  reloadTrigger?: number;
};

export function FolderTree({
  rootPath,
  selectedPath,
  onFolderSelect,
  onFavoriteAdded,
  searchFolders,
  revealPath,
  onRevealComplete,
  onFileDrop,
  reloadTrigger,
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
      setNodes(toNodes(entries));
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

  // Reload ボタン: 選択中フォルダ (未選択ならルート) の子フォルダを再取得し、展開状態を保ってマージする
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadTrigger is intentionally used to force re-fetch
  useEffect(() => {
    if (!reloadTrigger || !loaded) return;
    const target = selectedPath ?? rootPath;
    let cancelled = false;
    readDirectoryFolders(target)
      .then((fresh) => {
        if (cancelled) return;
        setNodes((prev) =>
          target === rootPath ? mergeNodes(prev, fresh) : replaceChildren(prev, target, fresh),
        );
      })
      .catch((err) => {
        console.error("Failed to reload folder tree:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTrigger]);

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
      expandPaths(prev, pathsToExpand, readDirectoryFolders).then((expanded) => {
        setNodes(expanded);
        onRevealComplete();
      });
      return prev;
    });
  }, [revealPath, loaded, rootPath, onRevealComplete]);

  const toggleNode = useCallback((path: string) => {
    setNodes((prev) => {
      toggleTreeNode(prev, path, readDirectoryFolders).then(setNodes);
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
          onFileDrop={onFileDrop}
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
