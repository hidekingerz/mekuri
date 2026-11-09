export type OpenErrorKind = "archive" | "pdf";

export type OpenErrorDescription = {
  /** 人向けの一次文 */
  summary: string;
  /** バックエンドやライブラリの生メッセージ */
  detail: string;
};

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /No such file|not found \(os error|os error 2\)/i,
    "ファイルが見つかりません。移動または削除された可能性があります",
  ],
  [/Permission denied|os error 13\)/i, "ファイルを読み取る権限がありません"],
  [/Unsupported archive format/i, "対応していない形式のファイルです"],
  [/ZIP archive|Zip archive/i, "この ZIP ファイルは壊れているか、ZIP 形式ではありません"],
  [/RAR archive|RAR header/i, "この RAR ファイルは壊れているか、RAR 形式ではありません"],
  [
    /Invalid PDF|PDF structure|PDF header|password/i,
    "この PDF ファイルは壊れているか、PDF 形式ではありません",
  ],
];

const FALLBACK: Record<OpenErrorKind, string> = {
  archive: "アーカイブを開けませんでした",
  pdf: "PDF を開けませんでした",
};

/** ファイルを開けなかったときの生メッセージを、人向けの一次文と詳細に分ける。 */
export function describeOpenError(raw: string, kind: OpenErrorKind): OpenErrorDescription {
  const rule = RULES.find(([pattern]) => pattern.test(raw));
  return { summary: rule ? rule[1] : FALLBACK[kind], detail: raw };
}
