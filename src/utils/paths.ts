/**
 * パスの文字列の扱い。Rust は OS の区切りのまま返すので、macOS / Linux の `/` と
 * Windows の `\` のどちらでも同じ結果になるようにする。
 */

const SEPARATORS = /[/\\]/;
const TRAILING_SEPARATORS = /[/\\]+$/;

function lastSeparator(path: string): number {
  return Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
}

/** path を入れているフォルダ。区切りが無い、または最上位なら null。 */
export function parentPath(path: string): string | null {
  const index = lastSeparator(path);
  return index > 0 ? path.slice(0, index) : null;
}

/** パスの最後の名前。 */
export function baseName(path: string): string {
  return path.slice(lastSeparator(path) + 1);
}

/**
 * folder から path までの名前の並び（folder 自身なら空）。path が folder の中に無ければ null。
 * 名前の前半が同じだけのフォルダ（manga と manga2）は、中にあるとは見なさない。
 */
export function segmentsBelow(folder: string, path: string): string[] | null {
  const base = folder.replace(TRAILING_SEPARATORS, "");
  if (!path.startsWith(base)) return null;
  const rest = path.slice(base.length);
  if (rest !== "" && !SEPARATORS.test(rest[0])) return null;
  return rest.split(SEPARATORS).filter(Boolean);
}

/** path が folder 自身か、その中にあるか。 */
export function isSameOrInside(folder: string, path: string): boolean {
  return segmentsBelow(folder, path) !== null;
}

/** path が folder の中にあるか（folder 自身は含まない）。 */
export function isInside(folder: string, path: string): boolean {
  return (segmentsBelow(folder, path)?.length ?? 0) > 0;
}

/** folder の下の name のパス。区切りは folder が使っているものに合わせる。 */
export function joinPath(folder: string, name: string): string {
  const separator = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
  return `${folder.replace(TRAILING_SEPARATORS, "")}${separator}${name}`;
}
