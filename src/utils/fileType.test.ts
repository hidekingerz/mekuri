import { describe, expect, it } from "vitest";
import { detectFileType } from "./fileType";

describe("detectFileType", () => {
  it("detects archive files", () => {
    expect(detectFileType("test.zip")).toBe("archive");
    expect(detectFileType("test.cbz")).toBe("archive");
    expect(detectFileType("test.rar")).toBe("archive");
    expect(detectFileType("test.cbr")).toBe("archive");
    expect(detectFileType("test.7z")).toBe("archive");
    expect(detectFileType("/path/to/file.ZIP")).toBe("archive");
  });

  it("detects PDF files", () => {
    expect(detectFileType("document.pdf")).toBe("pdf");
    expect(detectFileType("/path/to/file.PDF")).toBe("pdf");
  });

  it("returns unknown for other files", () => {
    expect(detectFileType("readme.txt")).toBe("unknown");
    expect(detectFileType("image.png")).toBe("unknown");
    expect(detectFileType("noext")).toBe("unknown");
  });
});
