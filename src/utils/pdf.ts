import type { PDFDocumentProxy } from "pdfjs-dist";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const CMAP_URL = "/pdfjs/cmaps/";
const STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/";

export async function loadPdfFromBase64(base64: string): Promise<PDFDocumentProxy> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const doc = await pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;
  return doc;
}

export async function renderPageToDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 2.0,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas 2d context");
  }

  await page.render({ canvasContext: context, canvas, viewport }).promise;
  return canvas.toDataURL("image/png");
}
