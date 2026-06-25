/**
 * backend の公開 API。新しいモジュールを追加したらここから re-export し、
 * `deno check backend/mod.ts` で型検査される状態を保つ。
 */

export { naturalCompare, naturalSort } from "./sort.ts";
export {
  isArchiveFile,
  isImageFile,
  isPdfFile,
  mimeTypeFromName,
} from "./extensions.ts";
export {
  type DirectoryEntry,
  readDirectory,
  readFileBase64,
  searchDirectory,
} from "./fs.ts";
export {
  analyzeContents,
  type ArchiveContents,
  extractNestedArchive,
  getImageBase64,
  listImages,
} from "./archive/zip.ts";
// RAR/CBR は zip と同名の関数を持つため名前空間付きで公開する。
// 形式ごとのディスパッチ（archive/mod.ts 相当）は別タスクで実装する。
export * as rar from "./archive/rar.ts";
