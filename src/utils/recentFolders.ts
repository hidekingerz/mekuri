/** ビューワでファイルを開いたフォルダの履歴。新しい順に並べ、1 フォルダ 1 件にまとめる。 */
export type RecentFolder = {
  folder: string;
  /** そのフォルダで最後に開いたファイルのパス */
  file: string;
  /** 開いた時刻（ミリ秒） */
  openedAt: number;
};

/** 画面に出す形。属するお気に入りと、お気に入りから下の短い場所を添える。 */
export type ResolvedRecentFolder = RecentFolder & {
  favorite: string;
  name: string;
  fileName: string;
  /** お気に入りの名前から始まる、フォルダまでの名前の並び */
  location: string[];
};

export const RECENT_FOLDERS_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

function parentOf(path: string): string | null {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : null;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** filePath を開いた記録を足した新しい履歴を返す。 */
export function recordOpen(list: RecentFolder[], filePath: string, now: number): RecentFolder[] {
  const folder = parentOf(filePath);
  if (!folder) return list;
  const rest = list.filter((entry) => entry.folder !== folder);
  return [{ folder, file: filePath, openedAt: now }, ...rest].slice(0, RECENT_FOLDERS_LIMIT);
}

/** 保存された値から、形の正しい項目だけを取り出す。 */
export function parseRecentFolders(value: unknown): RecentFolder[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is RecentFolder =>
      typeof v === "object" &&
      v !== null &&
      typeof v.folder === "string" &&
      typeof v.file === "string" &&
      typeof v.openedAt === "number",
  );
}

function favoriteFor(folder: string, favorites: string[]): string | null {
  let best: string | null = null;
  for (const fav of favorites) {
    const inside = folder === fav || folder.startsWith(`${fav}/`);
    if (inside && (best === null || fav.length > best.length)) best = fav;
  }
  return best;
}

/**
 * 画面に出す履歴。どのお気に入りにも入っていないフォルダ、もう無いフォルダ、
 * いま表示中のフォルダは除く。
 */
export function resolveRecentFolders(
  list: RecentFolder[],
  favorites: string[],
  currentFolder: string | null,
  exists: (folder: string) => boolean,
): ResolvedRecentFolder[] {
  const resolved: ResolvedRecentFolder[] = [];
  for (const entry of list) {
    if (entry.folder === currentFolder || !exists(entry.folder)) continue;
    const favorite = favoriteFor(entry.folder, favorites);
    if (!favorite) continue;
    const below = entry.folder.slice(favorite.length).split("/").filter(Boolean);
    resolved.push({
      ...entry,
      favorite,
      name: baseName(entry.folder),
      fileName: baseName(entry.file),
      location: [baseName(favorite), ...below],
    });
  }
  return resolved;
}

function startOfDay(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 開いた時刻を「今日」「昨日」「3 日前」「11月14日」のように短く表す。 */
export function formatOpenedAt(openedAt: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(openedAt)) / DAY_MS);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days} 日前`;
  const d = new Date(openedAt);
  const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === new Date(now).getFullYear()
    ? monthDay
    : `${d.getFullYear()}年${monthDay}`;
}
