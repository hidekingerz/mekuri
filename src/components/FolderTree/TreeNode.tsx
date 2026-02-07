import { ArchiveIcon, ChevronDown, ChevronRight, FolderIcon, FolderOpenIcon } from "../Icons/Icons";

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

  const handleClick = () => {
    if (entry.is_dir) {
      onToggle(entry.path);
    } else if (entry.is_archive) {
      onArchiveSelect(entry.path);
    }
  };

  const renderIcon = () => {
    if (entry.is_dir) {
      return node.isOpen ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />;
    }
    if (entry.is_archive) {
      return <ArchiveIcon size={16} />;
    }
    return null;
  };

  const renderChevron = () => {
    if (!entry.is_dir) {
      return <span className="tree-node__chevron tree-node__chevron--hidden" />;
    }
    return (
      <span className="tree-node__chevron">
        {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
    );
  };

  return (
    <>
      <div
        className={`tree-node ${entry.is_archive ? "tree-node--archive" : ""} ${entry.is_dir ? "tree-node--folder" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
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
        {depth > 0 && (
          <div className="tree-node__guides">
            {Array.from({ length: depth }).map((_, i) => (
              <span
                key={`guide-${entry.path}-${i}`}
                className="tree-node__guide"
                style={{ left: `${i * 20 + 16}px` }}
              />
            ))}
          </div>
        )}
        {renderChevron()}
        <span className="tree-node__icon">{renderIcon()}</span>
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
