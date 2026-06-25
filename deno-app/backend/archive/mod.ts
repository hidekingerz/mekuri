/**
 * アーカイブ共通処理・形式ディスパッチ。
 *
 * Tauri 版 `src-tauri/src/archive/mod.rs` の `detect_format` と、それを使った
 * `list_images` / `analyze_contents` / `extract_nested_archive` / `get_image_base64`
 * の振り分けに相当する。拡張子で ZIP 系／RAR 系を判別し、対応する実装へ委譲する。
 * Deno Desktop API には依存しない純粋ロジックとして保つ。
 */

import * as zip from "./zip.ts";
import * as rar from "./rar.ts";
import type { ArchiveContents } from "./zip.ts";

export type { ArchiveContents };

/** サポートするアーカイブ形式の分類。Tauri 版 `ArchiveFormat` 相当。 */
type ArchiveFormat = "zip" | "rar";

/** パスの拡張子（小文字、ドットなし）を取り出す。無ければ空文字。 */
function extensionOf(archivePath: string): string {
  const base = archivePath.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

/**
 * ファイルパスの拡張子からアーカイブ形式を判別する。
 * Tauri 版 `detect_format` と同じく未対応拡張子はエラーにする。
 */
function detectFormat(archivePath: string): ArchiveFormat {
  const ext = extensionOf(archivePath);
  switch (ext) {
    case "zip":
    case "cbz":
      return "zip";
    case "rar":
    case "cbr":
      return "rar";
    default:
      throw new Error(`Unsupported archive format: .${ext}`);
  }
}

/** アーカイブ内の画像エントリ名を自然順ソートで返す。 */
export async function listImages(archivePath: string): Promise<string[]> {
  return detectFormat(archivePath) === "zip"
    ? await zip.listImages(archivePath)
    : await rar.listImages(archivePath);
}

/** アーカイブの内容を分析し、画像／ネストアーカイブ／空のいずれかを返す。 */
export async function analyzeContents(
  archivePath: string,
): Promise<ArchiveContents> {
  return detectFormat(archivePath) === "zip"
    ? await zip.analyzeContents(archivePath)
    : await rar.analyzeContents(archivePath);
}

/** ネストされたアーカイブを一時ディレクトリへ展開し、その絶対パスを返す。 */
export async function extractNestedArchive(
  parentPath: string,
  nestedName: string,
): Promise<string> {
  return detectFormat(parentPath) === "zip"
    ? await zip.extractNestedArchive(parentPath, nestedName)
    : await rar.extractNestedArchive(parentPath, nestedName);
}

/** アーカイブ内の 1 画像を取り出し Base64 data URL で返す。 */
export async function getImageBase64(
  archivePath: string,
  entryName: string,
): Promise<string> {
  return detectFormat(archivePath) === "zip"
    ? await zip.getImageBase64(archivePath, entryName)
    : await rar.getImageBase64(archivePath, entryName);
}
