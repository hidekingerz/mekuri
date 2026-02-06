import { useCallback, useState } from "react";
import { readDirectory } from "../../hooks/useDirectory";
import type { DirectoryEntry } from "../../types";
import { TreeNode } from "./TreeNode";

interface TreeNodeData {
  entry: DirectoryEntry;
  children: TreeNodeData[] | null; // null = not loaded yet
  isOpen: boolean;
}

interface FolderTreeProps {
  rootPath: string;
  onArchiveSelect: (path: string) => void;
}

export function FolderTree({ rootPath, onArchiveSelect }: FolderTreeProps) {
  const [nodes, setNodes] = useState<TreeNodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadRoot = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const entries = await readDirectory(rootPath);
      setNodes(entries.map((entry) => ({ entry, children: null, isOpen: false })));
      setLoaded(true);
    } catch (err) {
      console.error("Failed to load root directory:", err);
    } finally {
      setLoading(false);
    }
  }, [rootPath, loaded]);

  // Load root on first render
  if (!loaded && !loading) {
    loadRoot();
  }

  // Reset when rootPath changes
  const [prevRoot, setPrevRoot] = useState(rootPath);
  if (prevRoot !== rootPath) {
    setPrevRoot(rootPath);
    setNodes([]);
    setLoaded(false);
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
                const entries = await readDirectory(path);
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

  if (loading && nodes.length === 0) {
    return <div className="folder-tree-loading">Loading...</div>;
  }

  return (
    <div className="folder-tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.entry.path}
          node={node}
          depth={0}
          onToggle={toggleNode}
          onArchiveSelect={onArchiveSelect}
        />
      ))}
    </div>
  );
}
