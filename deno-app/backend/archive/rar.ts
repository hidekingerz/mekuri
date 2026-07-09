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
import { readArchiveBytes } from "./cache.ts";

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
    data = await readArchiveBytes(archivePath);
  } catch (e) {
    throw new Error(`Failed to open RAR archive: ${errMsg(e)}`);
  }
  // node-unrar-js は ArrayBuffer を要求する。Deno.readFile の結果から
  // 新しい ArrayBuffer を確保して渡す（SharedArrayBuffer 型の混入も防ぐ）。
  const buffer = new Uint8Array(data).buffer;
  return await createExtractorFromData({ data: buffer });
}

// --- デコード済み画像のキャッシュ & 直列化 ---
// `getImageBase64` は画像 1 枚ごとに `openRar`（= `createExtractorFromData` で wasm が RAR
// 全体を解析）+ extract していて、連続ページ送りで RAR が重かった（ZIP は zip-js で軽い）。
// node-unrar-js の extractor は extract() を複数回呼べない（再利用不可）ため、最初のアクセス時に
// 1 つの extractor で全画像を 1 回の extract（述語フィルタ）でまとめて展開し、entryName→bytes を
// path 別にキャッシュする（以降のページは即時）。さらに node-unrar-js は wasm を共有し並行 extract
// で壊れて稀に "Entry not found" になるため、全 RAR 操作を直列化する。

/** RAR 抽出器を生成する関数（テストで差し替え可能）。既定は `openRar`。 */
export type ExtractorFactory = (archivePath: string) => Promise<RarExtractor>;

/** 1 書庫分のデコード済み画像（entryName → 画像バイト列）。 */
export type DecodedImages = Map<string, Uint8Array>;

const decodedCache = new Map<string, Promise<DecodedImages>>();
/** 同時に保持する書庫の最大数（別書庫を開くと古いものから退避）。 */
const MAX_DECODED = 2;

let rarLock: Promise<void> = Promise.resolve();

/** 全 RAR 操作を直列化する（共有 wasm の並行使用を防ぐ）。 */
export function withRarLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = rarLock.then(fn);
  rarLock = result.then(() => undefined, () => undefined);
  return result;
}

/** 欲しい画像エントリか（ディレクトリ・__MACOSX を除く画像）。extract の述語にも使う。 */
function isWantedImage(name: string, directory: boolean): boolean {
  return !directory && isImageFile(name) && !name.includes("__MACOSX");
}

/**
 * RAR 内の全画像を 1 回の extract でまとめて展開し、entryName→bytes の Map を path 別に
 * キャッシュ（LRU）して返す。最初のアクセスで全展開し、以降のページ取得は即時。生成失敗は
 * キャッシュから除き、後続が読み直せるようにする。
 */
export function getDecodedImages(
  archivePath: string,
  factory: ExtractorFactory = openRar,
): Promise<DecodedImages> {
  const cached = decodedCache.get(archivePath);
  if (cached) {
    decodedCache.delete(archivePath);
    decodedCache.set(archivePath, cached); // 最近使用（末尾）へ
    return cached;
  }
  const built = withRarLock(async () => {
    const extractor = await factory(archivePath);
    const images: DecodedImages = new Map();
    let files;
    try {
      files = extractor.extract({
        files: (header) => isWantedImage(header.name, header.flags.directory),
      }).files;
    } catch (e) {
      throw new Error(`Failed to read RAR archive: ${errMsg(e)}`);
    }
    for (const file of files) {
      if (file.extraction) images.set(file.fileHeader.name, file.extraction);
    }
    return images;
  }).catch((e) => {
    decodedCache.delete(archivePath);
    throw e;
  });
  decodedCache.set(archivePath, built);
  while (decodedCache.size > MAX_DECODED) {
    const oldest = decodedCache.keys().next().value as string;
    decodedCache.delete(oldest);
  }
  return built;
}

/** デコード済み画像キャッシュを空にする（テストの分離用）。 */
export function clearRarCache(): void {
  decodedCache.clear();
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
export function listImages(archivePath: string): Promise<string[]> {
  return withRarLock(async () => {
    const extractor = await openRar(archivePath);
    const names = listFileNames(extractor).filter(
      (name) => isImageFile(name) && !name.includes("__MACOSX"),
    );
    names.sort(naturalCompare);
    return names;
  });
}

/** RAR の内容を分析し、画像／ネストアーカイブ／空のいずれかを返す。 */
export function analyzeContents(
  archivePath: string,
): Promise<ArchiveContents> {
  return withRarLock(async () => {
    const extractor = await openRar(archivePath);
    return analyzeExtractor(extractor);
  });
}

/** 抽出器の内容を分析する（画像／ネストアーカイブ／空）。 */
function analyzeExtractor(extractor: RarExtractor): ArchiveContents {
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
export function extractNestedArchive(
  parentPath: string,
  nestedName: string,
): Promise<string> {
  return withRarLock(async () => {
    const extractor = await openRar(parentPath);
    const buf = extractEntryData(extractor, nestedName);

    const tempDir = await Deno.makeTempDir();
    const tempPath = `${tempDir}/${baseName(nestedName)}`;
    await Deno.writeFile(tempPath, buf);
    return tempPath;
  });
}

/** RAR 内の 1 画像を取り出し Base64 data URL で返す。 */
export function getImageBase64(
  archivePath: string,
  entryName: string,
): Promise<string> {
  return getDecodedImages(archivePath).then((images) => {
    const buf = images.get(entryName);
    if (!buf) throw new Error(`Entry not found: ${entryName}`);
    return `data:${mimeTypeFromName(entryName)};base64,${encodeBase64(buf)}`;
  });
}
