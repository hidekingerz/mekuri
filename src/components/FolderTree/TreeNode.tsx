import { useState } from "react";
import type { TreeNodeData } from "../../types";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { ChevronDown, ChevronRight, FolderIcon, FolderOpenIcon } from "../Icons/Icons";

type TreeNodeProps = {
  node: TreeNodeData;
  depth: number;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
  onFileDrop: (srcPath: string, destDir: string) => void;
};

export function TreeNode({
  node,
  depth,
  selectedPath,
  onToggle,
  onSelect,
  onContextMenu,
  onFileDrop,
}: TreeNodeProps) {
  const { entry } = node;
  const isSelected = entry.path === selectedPath;
  const [isDragOver, setIsDragOver] = useState(false);
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

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(FILE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const srcPath = e.dataTransfer.getData(FILE_DRAG_MIME);
    if (srcPath) {
      onFileDrop(srcPath, entry.path);
    }
  };

  return (
    <>
      <div
        className={`tree-node tree-node--folder ${isSelected ? "tree-node--selected" : ""}${isDragOver ? " tree-node--drop-target" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
            onFileDrop={onFileDrop}
          />
        ))}
    </>
  );
}
