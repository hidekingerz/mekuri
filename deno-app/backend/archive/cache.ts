/**
 * アーカイブのバイト列を path 別にキャッシュする小さな LRU。
 *
 * Tauri 版（`src-tauri/src/archive/zip.rs`）は `ZipArchive::by_name` で中央
 * ディレクトリと該当エントリのみをストリーム読みするため軽いが、Deno 版は
 * 画像 1 枚ごとに `Deno.readFile(archivePath)` で書庫全体を読み直していた。
 * 連続ページ送りで同一書庫を何度も再読込するのを避けるため、直近に開いた
 * 数件の書庫バイト列をここで共有する。`listImages` / `analyzeContents` /
 * `getImageBase64` が `zip.ts` / `rar.ts` 経由でこのキャッシュを使う。
 *
 * Deno Desktop API には依存しない純粋ロジックとして保ち、reader を注入可能に
 * してスパイ検証できるようにする。
 */

/** path からバイト列を読む関数（既定は `Deno.readFile`）。 */
export type ArchiveReader = (path: string) => Promise<Uint8Array>;

const defaultReader: ArchiveReader = (path) => Deno.readFile(path);

/** 同時に保持する書庫の最大数。別書庫を開くと古いものから退避する。 */
const MAX_ENTRIES = 2;

interface CacheEntry {
  path: string;
  // バイト列ではなく Promise を保持する。これにより並行要求が in-flight の
  // 読み込みを共有し、書庫あたり reader 呼び出しが 1 回に収まる。
  data: Promise<Uint8Array>;
}

/** 直近に使ったものほど末尾に来る（先頭が最古＝次に退避される）。 */
const cache: CacheEntry[] = [];

/**
 * 指定 path の書庫バイト列を返す。キャッシュにあれば（読み込み中でも）その
 * Promise を共有し、無ければ reader で読んでキャッシュへ載せる（LRU、最大
 * `MAX_ENTRIES` 件）。読み込みが失敗した場合はキャッシュから除去し、後続の
 * 要求が読み直せるようにする。
 */
export function readArchiveBytes(
  path: string,
  reader: ArchiveReader = defaultReader,
): Promise<Uint8Array> {
  const index = cache.findIndex((entry) => entry.path === path);
  if (index !== -1) {
    // ヒットしたエントリを最近使用（末尾）へ移動する。
    const [entry] = cache.splice(index, 1);
    cache.push(entry);
    return entry.data;
  }
  const data = reader(path).catch((e) => {
    const i = cache.findIndex((entry) => entry.path === path);
    if (i !== -1) cache.splice(i, 1);
    throw e;
  });
  cache.push({ path, data });
  while (cache.length > MAX_ENTRIES) {
    cache.shift();
  }
  return data;
}

/** キャッシュを空にする（主にテストの分離用）。 */
export function clearArchiveCache(): void {
  cache.length = 0;
}
