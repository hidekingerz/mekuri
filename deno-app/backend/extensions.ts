/**
 * ファイル拡張子による種別判定。
 *
 * Tauri 版 `src-tauri/src/archive/mod.rs` の `is_archive_file` / `is_pdf_file` /
 * `is_image_file` / `mime_type_from_name` に相当する純粋ロジック。
 * `backend/` は Deno Desktop API に依存させない方針のため、ここに集約する。
 */

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif"] as const;
const ARCHIVE_EXTENSIONS = ["zip", "cbz", "rar", "cbr", "7z"] as const;
const PDF_EXTENSIONS = ["pdf"] as const;

function hasExtension(name: string, extensions: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(`.${ext}`));
}

/** 画像拡張子なら true。 */
export function isImageFile(name: string): boolean {
  return hasExtension(name, IMAGE_EXTENSIONS);
}

/** PDF 拡張子なら true。 */
export function isPdfFile(name: string): boolean {
  return hasExtension(name, PDF_EXTENSIONS);
}

/** アーカイブ拡張子なら true。 */
export function isArchiveFile(name: string): boolean {
  return hasExtension(name, ARCHIVE_EXTENSIONS);
}

/** 拡張子から MIME タイプを推定する（既定は image/jpeg）。 */
export function mimeTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}
