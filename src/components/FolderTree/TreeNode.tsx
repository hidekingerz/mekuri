interface TreeNodeData {
  entry: {
    name: string;
    path: string;
    is_dir: boolean;
    is_archive: boolean;
  };
  children: TreeNodeData[] | null;
  isOpen: boolean;
}

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  onToggle: (path: string) => void;
  onArchiveSelect: (path: string) => void;
}

export function TreeNode({ node, depth, onToggle, onArchiveSelect }: TreeNodeProps) {
  const { entry } = node;
  const indent = depth * 16;

  const handleClick = () => {
    if (entry.is_dir) {
      onToggle(entry.path);
    } else if (entry.is_archive) {
      onArchiveSelect(entry.path);
    }
  };

  const icon = entry.is_dir ? (node.isOpen ? "\u25BC" : "\u25B6") : "\u{1F4E6}";

  return (
    <>
      <div
        className={`tree-node ${entry.is_archive ? "tree-node--archive" : ""}`}
        style={{ paddingLeft: `${indent + 4}px` }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        role="treeitem"
        tabIndex={0}
      >
        <span className="tree-node__icon">{icon}</span>
        <span className="tree-node__name">{entry.name}</span>
      </div>
      {node.isOpen &&
        node.children?.map((child) => (
          <TreeNode
            key={child.entry.path}
            node={child}
            depth={depth + 1}
            onToggle={onToggle}
            onArchiveSelect={onArchiveSelect}
          />
        ))}
    </>
  );
}
