/**
 * 自然順ソート（natural order sort）。
 *
 * Tauri 版の `natord` クレートに相当する。ファイル名中の数字を数値として比較し、
 * "img2.png" が "img10.png" より前に来るようにする。
 *
 * `backend/` は Deno Desktop API に依存しない純粋ロジックとして実装する方針の参照実装。
 */

/** 文字列を「数字の連なり」と「それ以外」のチャンクに分割する。 */
function chunk(value: string): string[] {
  return value.match(/(\d+|\D+)/g) ?? [];
}

/**
 * 2つの文字列を自然順で比較する。`a < b` なら負、`a > b` なら正、等しければ 0。
 * `Array.prototype.sort` のコンパレータとして使える。
 */
export function naturalCompare(a: string, b: string): number {
  const ax = chunk(a);
  const bx = chunk(b);
  const len = Math.min(ax.length, bx.length);

  for (let i = 0; i < len; i++) {
    const an = ax[i];
    const bn = bx[i];
    const bothNumeric = /^\d/.test(an) && /^\d/.test(bn);

    if (bothNumeric) {
      const diff = Number(an) - Number(bn);
      if (diff !== 0) return diff < 0 ? -1 : 1;
      // 数値が等しい場合（先頭ゼロ違い等）は文字列長で安定させる
      if (an.length !== bn.length) return an.length - bn.length;
    } else {
      const cmp = an.localeCompare(bn);
      if (cmp !== 0) return cmp;
    }
  }

  return ax.length - bx.length;
}

/** 文字列配列を自然順でソートした新しい配列を返す（非破壊）。 */
export function naturalSort(values: readonly string[]): string[] {
  return [...values].sort(naturalCompare);
}
