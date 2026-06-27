/**
 * ZIP/CBZ アーカイブの展開ロジック。
 *
 * Tauri 版 `src-tauri/src/archive/zip.rs` の `list_images` / `analyze_contents` /
 * `extract_nested_archive` / `get_image_base64` に相当する。ZIP の読み取りには
 * `@zip-js/zip-js`（Deno 対応・純粋 JS）を使い、Deno Desktop API には依存しない。
 */

import {
  configure,
  type Entry,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip-js/zip-js";
import { naturalCompare } from "../sort.ts";
import { isArchiveFile, isImageFile, mimeTypeFromName } from "../extensions.ts";
import { readArchiveBytes } from "./cache.ts";

// テスト・サーバープロセス内で Web Worker を使わず確実に動かす。
configure({ useWebWorkers: false });

/**
 * アーカイブ内容の分類結果。Tauri 版 `ArchiveContents`（serde tag = "type"）と
 * 同じ判別共用体の形を保ち、フロント側の判定インターフェースを維持する。
 */
export type ArchiveContents =
  | { type: "Images"; names: string[] }
  | { type: "NestedArchives"; names: string[] }
  | { type: "Empty" };

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

/** アーカイブを開き ZipReader を返す。読み込み失敗はエラーにする。 */
async function openZip(archivePath: string): Promise<ZipReader<unknown>> {
  let data: Uint8Array;
  try {
    data = await readArchiveBytes(archivePath);
  } catch (e) {
    throw new Error(`Failed to open archive: ${errMsg(e)}`);
  }
  return new ZipReader(new Uint8ArrayReader(data));
}

/** ZipReader からエントリ一覧を取得する。ZIP として読めない場合はエラー。 */
async function getEntries(reader: ZipReader<unknown>): Promise<Entry[]> {
  try {
    return await reader.getEntries();
  } catch (e) {
    throw new Error(`Failed to read ZIP archive: ${errMsg(e)}`);
  }
}

/** 名前一致するエントリのデータを読み出す。見つからなければエラー。 */
async function readEntryData(
  entries: Entry[],
  entryName: string,
): Promise<Uint8Array> {
  const entry = entries.find((e) => e.filename === entryName);
  if (!entry || entry.directory || !entry.getData) {
    throw new Error(`Entry not found: ${entryName}`);
  }
  return await entry.getData(new Uint8ArrayWriter());
}

/** ZIP 内の画像エントリ名を自然順ソートで返す（__MACOSX は除外）。 */
export async function listImages(archivePath: string): Promise<string[]> {
  const reader = await openZip(archivePath);
  try {
    const entries = await getEntries(reader);
    const names = entries
      .filter(
        (e) =>
          !e.directory &&
          isImageFile(e.filename) &&
          !e.filename.includes("__MACOSX"),
      )
      .map((e) => e.filename);
    names.sort(naturalCompare);
    return names;
  } finally {
    await reader.close();
  }
}

/** ZIP の内容を分析し、画像／ネストアーカイブ／空のいずれかを返す。 */
export async function analyzeContents(
  archivePath: string,
): Promise<ArchiveContents> {
  const reader = await openZip(archivePath);
  try {
    const entries = await getEntries(reader);

    const images: string[] = [];
    const nestedArchives: string[] = [];

    for (const entry of entries) {
      if (entry.directory) continue;
      const name = entry.filename;
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
  } finally {
    await reader.close();
  }
}

/**
 * ネストされたアーカイブを一時ディレクトリへ展開し、その絶対パスを返す。
 * 一時ディレクトリの後始末はアプリ側に委ねる（Tauri 版は終了まで保持）。
 */
export async function extractNestedArchive(
  parentPath: string,
  nestedName: string,
): Promise<string> {
  const reader = await openZip(parentPath);
  try {
    const entries = await getEntries(reader);
    const buf = await readEntryData(entries, nestedName);

    const tempDir = await Deno.makeTempDir();
    const tempPath = `${tempDir}/${baseName(nestedName)}`;
    await Deno.writeFile(tempPath, buf);
    return tempPath;
  } finally {
    await reader.close();
  }
}

/** ZIP 内の 1 画像を取り出し Base64 data URL で返す。 */
export async function getImageBase64(
  archivePath: string,
  entryName: string,
): Promise<string> {
  const reader = await openZip(archivePath);
  try {
    const entries = await getEntries(reader);
    const buf = await readEntryData(entries, entryName);
    return `data:${mimeTypeFromName(entryName)};base64,${encodeBase64(buf)}`;
  } finally {
    await reader.close();
  }
}
