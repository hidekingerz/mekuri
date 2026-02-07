import { ChevronDown, ChevronRight, FolderIcon, FolderOpenIcon } from "../Icons/Icons";

interface TreeNodeData {
  entry: {
    name: string;
    path: string;
    is_dir: boolean;
    is_archive: boolean;
    has_subfolders: boolean;
  };
  children: TreeNodeData[] | null;
  isOpen: boolean;
}

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

export function TreeNode({
  node,
  depth,
  selectedPath,
  onToggle,
  onSelect,
  onContextMenu,
}: TreeNodeProps) {
  const { entry } = node;
  const isSelected = entry.path === selectedPath;
  // Hide chevron if the folder has no subfolders
  const hasChildren = entry.has_subfolders;

  const handleClick = () => {
    onSelect(entry.path);
  };

  const handleDoubleClick = () => {
    onToggle(entry.path);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    onContextMenu(e, entry.path);
  };

  return (
    <>
      <div
        className={`tree-node tree-node--folder ${isSelected ? "tree-node--selected" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
          if (e.key === "ArrowRight" && !node.isOpen) {
            e.preventDefault();
            onToggle(entry.path);
          }
          if (e.key === "ArrowLeft" && node.isOpen) {
            e.preventDefault();
            onToggle(entry.path);
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
        {hasChildren ? (
          <button
            type="button"
            className="tree-node__chevron"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(entry.path);
            }}
            tabIndex={-1}
          >
            {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="tree-node__chevron-placeholder" />
        )}
        <span className="tree-node__icon">
          {node.isOpen ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />}
        </span>
        <span className="tree-node__name">{entry.name}</span>
      </div>
      {node.isOpen &&
        node.children?.map((child) => (
          <TreeNode
            key={child.entry.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onToggle={onToggle}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
}
