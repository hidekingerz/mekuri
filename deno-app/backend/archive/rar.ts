/**
 * RAR/CBR アーカイブの展開ロジック。
 *
 * Tauri 版 `src-tauri/src/archive/rar.rs` の `list_images` / `analyze_contents` /
 * `extract_nested_archive` / `get_image_base64` に相当する。RAR の読み取りには
 * `node-unrar-js`（wasm 実装の unrar・純粋 JS）を使い、Deno Desktop API には
 * 依存しない。`ArchiveContents` 型は `zip.ts` の定義を共有する。
 */

import { createExtractorFromData } from "node-unrar-js";
import { naturalCompare } from "../sort.ts";
import { isArchiveFile, isImageFile, mimeTypeFromName } from "../extensions.ts";
import type { ArchiveContents } from "./zip.ts";

export type { ArchiveContents };

/** createExtractorFromData が返す抽出器の型エイリアス。 */
type RarExtractor = Awaited<ReturnType<typeof createExtractorFromData>>;

/** エラーオブジェクトからメッセージ文字列を取り出す。 */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** パス末尾のファイル名のみを取り出す（区切りは / と \ の両方を考慮）。 */
function baseName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "archive";
}

/** Uint8Array を標準 Base64 文字列へエンコードする。 */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** アーカイブを読み込み RAR 抽出器を返す。読み込み失敗はエラーにする。 */
async function openRar(archivePath: string): Promise<RarExtractor> {
  let data: Uint8Array;
  try {
    data = await Deno.readFile(archivePath);
  } catch (e) {
    throw new Error(`Failed to open RAR archive: ${errMsg(e)}`);
  }
  // node-unrar-js は ArrayBuffer を要求する。Deno.readFile の結果から
  // 新しい ArrayBuffer を確保して渡す（SharedArrayBuffer 型の混入も防ぐ）。
  const buffer = new Uint8Array(data).buffer;
  return await createExtractorFromData({ data: buffer });
}

/** RAR 内の全ファイルエントリ名（ディレクトリ除く）を列挙する。 */
function listFileNames(extractor: RarExtractor): string[] {
  try {
    const names: string[] = [];
    for (const header of extractor.getFileList().fileHeaders) {
      if (!header.flags.directory) {
        names.push(header.name);
      }
    }
    return names;
  } catch (e) {
    throw new Error(`Failed to read RAR archive: ${errMsg(e)}`);
  }
}

/** 名前一致するエントリのデータを抽出する。見つからなければエラー。 */
function extractEntryData(
  extractor: RarExtractor,
  entryName: string,
): Uint8Array {
  let files;
  try {
    files = extractor.extract({ files: [entryName] }).files;
  } catch (e) {
    throw new Error(`Failed to read RAR archive: ${errMsg(e)}`);
  }
  for (const file of files) {
    if (file.fileHeader.name === entryName && file.extraction) {
      return file.extraction;
    }
  }
  throw new Error(`Entry not found: ${entryName}`);
}

/** RAR 内の画像エントリ名を自然順ソートで返す（__MACOSX は除外）。 */
export async function listImages(archivePath: string): Promise<string[]> {
  const extractor = await openRar(archivePath);
  const names = listFileNames(extractor).filter(
    (name) => isImageFile(name) && !name.includes("__MACOSX"),
  );
  names.sort(naturalCompare);
  return names;
}

/** RAR の内容を分析し、画像／ネストアーカイブ／空のいずれかを返す。 */
export async function analyzeContents(
  archivePath: string,
): Promise<ArchiveContents> {
  const extractor = await openRar(archivePath);

  const images: string[] = [];
  const nestedArchives: string[] = [];

  for (const name of listFileNames(extractor)) {
    if (name.includes("__MACOSX")) continue;

    if (isImageFile(name)) {
      images.push(name);
    } else if (isArchiveFile(name)) {
      nestedArchives.push(name);
    }
  }

  if (images.length > 0) {
    images.sort(naturalCompare);
    return { type: "Images", names: images };
  }
  if (nestedArchives.length > 0) {
    nestedArchives.sort(naturalCompare);
    return { type: "NestedArchives", names: nestedArchives };
  }
  return { type: "Empty" };
}

/**
 * ネストされたアーカイブを一時ディレクトリへ展開し、その絶対パスを返す。
 * 一時ディレクトリの後始末はアプリ側に委ねる（Tauri 版は終了まで保持）。
 */
export async function extractNestedArchive(
  parentPath: string,
  nestedName: string,
): Promise<string> {
  const extractor = await openRar(parentPath);
  const buf = extractEntryData(extractor, nestedName);

  const tempDir = await Deno.makeTempDir();
  const tempPath = `${tempDir}/${baseName(nestedName)}`;
  await Deno.writeFile(tempPath, buf);
  return tempPath;
}

/** RAR 内の 1 画像を取り出し Base64 data URL で返す。 */
export async function getImageBase64(
  archivePath: string,
  entryName: string,
): Promise<string> {
  const extractor = await openRar(archivePath);
  const buf = extractEntryData(extractor, entryName);
  return `data:${mimeTypeFromName(entryName)};base64,${encodeBase64(buf)}`;
}
