export type DirectoryEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  is_archive: boolean;
  is_pdf: boolean;
  has_subfolders: boolean;
};

export type TreeNodeData = {
  entry: DirectoryEntry;
  children: TreeNodeData[] | null;
  isOpen: boolean;
};
