/**
 * backend の公開 API。新しいモジュールを追加したらここから re-export し、
 * `deno check backend/mod.ts` で型検査される状態を保つ。
 */

export { naturalCompare, naturalSort } from "./sort.ts";
export { Store, type StoreOptions, type StoreState } from "./store.ts";
export {
  addFavorite,
  DEFAULT_MAIN_SETTINGS,
  DEFAULT_VIEWER_SETTINGS,
  FAVORITES_KEY,
  getFavorites,
  getViewerSettings,
  getWindowSettings,
  type MainWindowSettings,
  type ReadingDirection,
  removeFavorite,
  saveViewerSettings,
  saveWindowSettings,
  VIEWER_SETTINGS_KEY,
  type ViewerWindowSettings,
  type ViewMode,
  WINDOW_SETTINGS_KEY,
} from "./settings.ts";
export {
  isArchiveFile,
  isImageFile,
  isPdfFile,
  mimeTypeFromName,
} from "./extensions.ts";
export {
  type DirectoryEntry,
  type FileDeleter,
  readDirectory,
  readFileBase64,
  searchDirectory,
  trashFile,
} from "./fs.ts";
// アーカイブ操作は拡張子で ZIP/RAR を振り分ける統一ディスパッチ API を公開する。
export {
  analyzeContents,
  type ArchiveContents,
  extractNestedArchive,
  getImageBase64,
  listImages,
} from "./archive/mod.ts";
