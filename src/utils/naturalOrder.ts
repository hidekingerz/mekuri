/**
 * ファイル名の自然順。Rust 側（src-tauri/src/natural_order.rs の compare）と同じ規則で比べる。
 * 一覧の並びは Rust が決めるので、こちらは「一覧に無い名前が入るはずの位置」を求めるときにだけ使う。
 *
 * - 数字の並びは数値として比べる（ゼロ埋めの有無は問わない）
 * - 文字は大文字と小文字を区別せずに比べる
 * - そこまでで差が付かないときは、ゼロ埋めの少ないほう、次に文字コード順
 */
export function compareNatural(a: string, b: string): number {
  const left = a.match(TOKEN) ?? [];
  const right = b.match(TOKEN) ?? [];
  let spelling = 0;

  for (let i = 0; i < left.length || i < right.length; i++) {
    if (i >= left.length) return -1;
    if (i >= right.length) return 1;
    const x = left[i];
    const y = right[i];

    if (DIGIT.test(x) && DIGIT.test(y)) {
      const byValue = compareNumbers(x, y);
      if (byValue !== 0) return byValue;
      spelling ||= Math.sign(x.length - y.length);
    } else {
      const ignoringCase = compareCodePoints(x.toLowerCase(), y.toLowerCase());
      if (ignoringCase !== 0) return ignoringCase;
      spelling ||= compareCodePoints(x, y);
    }
  }
  return spelling;
}

/** 数字の並び、または数字以外の 1 文字。 */
const TOKEN = /[0-9]+|[^0-9]/gu;
/** トークンは数字だけか数字以外の 1 文字なので、数字を含むかどうかで見分けられる。 */
const DIGIT = /[0-9]/;

/** 数字の並びを数値として比べる。桁数に上限は無い。 */
function compareNumbers(a: string, b: string): number {
  const x = a.replace(/^0+/, "");
  const y = b.replace(/^0+/, "");
  return Math.sign(x.length - y.length) || compareCodePoints(x, y);
}

/** 文字コード（コードポイント）の順で比べる。 */
function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a, (char) => char.codePointAt(0) ?? 0);
  const y = Array.from(b, (char) => char.codePointAt(0) ?? 0);
  for (let k = 0; k < x.length && k < y.length; k++) {
    if (x[k] !== y[k]) return Math.sign(x[k] - y[k]);
  }
  return Math.sign(x.length - y.length);
}
