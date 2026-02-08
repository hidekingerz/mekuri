export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_archive: boolean;
  has_subfolders: boolean;
}

export interface TreeNodeData {
  entry: DirectoryEntry;
  children: TreeNodeData[] | null;
  isOpen: boolean;
}
