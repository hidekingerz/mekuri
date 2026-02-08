import { useCallback, useEffect, useState } from "react";
import { readDirectoryFolders } from "../../api/directory";
import { addFavorite } from "../../api/favorites";
import { useContextMenu } from "../../hooks/useContextMenu";
import type { TreeNodeData } from "../../types";
import { TreeNode } from "./TreeNode";

type FolderTreeProps = {
  rootPath: string;
  selectedPath: string | null;
  onFolderSelect: (path: string) => void;
  onFavoriteAdded?: () => void;
};

export function FolderTree({
  rootPath,
  selectedPath,
  onFolderSelect,
  onFavoriteAdded,
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
      setError(String(err));
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
