import { describe, expect, it } from "vitest";
import { describeOpenError } from "./openErrorMessage";

describe("describeOpenError", () => {
  it("explains a corrupt ZIP in plain words and keeps the raw message as detail", () => {
    const raw = "Failed to read ZIP archive: invalid Zip archive: Could not find EOCD";
    expect(describeOpenError(raw, "archive")).toEqual({
      summary: "この ZIP ファイルは壊れているか、ZIP 形式ではありません",
      detail: raw,
    });
  });

  it("explains a corrupt RAR", () => {
    expect(describeOpenError("Failed to open RAR archive: bad data", "archive").summary).toBe(
      "この RAR ファイルは壊れているか、RAR 形式ではありません",
    );
  });

  it("explains a missing file", () => {
    expect(
      describeOpenError("Failed to open archive: No such file or directory (os error 2)", "archive")
        .summary,
    ).toBe("ファイルが見つかりません。移動または削除された可能性があります");
  });

  it("explains a permission error", () => {
    expect(
      describeOpenError("Failed to open archive: Permission denied (os error 13)", "archive")
        .summary,
    ).toBe("ファイルを読み取る権限がありません");
  });

  it("explains an unsupported format", () => {
    expect(describeOpenError("Unsupported archive format: .7z", "archive").summary).toBe(
      "対応していない形式のファイルです",
    );
  });

  it("falls back to a generic summary per kind", () => {
    expect(describeOpenError("something odd", "archive").summary).toBe(
      "アーカイブを開けませんでした",
    );
    expect(describeOpenError("something odd", "pdf").summary).toBe("PDF を開けませんでした");
  });

  it("explains a broken PDF", () => {
    expect(describeOpenError("Invalid PDF structure.", "pdf").summary).toBe(
      "この PDF ファイルは壊れているか、PDF 形式ではありません",
    );
  });
});
