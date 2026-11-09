export type DirectoryEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  is_archive: boolean;
  is_pdf: boolean;
  has_subfolders: boolean;
  /** 最終更新日時（UNIX ミリ秒）。取得できなければ null */
  modified_ms?: number | null;
  /** ファイルサイズ（バイト）。フォルダは null */
  size?: number | null;
};

export type TreeNodeData = {
  entry: DirectoryEntry;
  children: TreeNodeData[] | null;
  isOpen: boolean;
};

/** ビューワーの同一フォルダ内の前後ファイルへの移動操作 */
export type SiblingNavigation = {
  hasNext: boolean;
  hasPrev: boolean;
  goNext: () => void;
  goPrev: () => void;
};
