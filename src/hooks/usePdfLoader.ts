import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { readFileBase64 } from "../api/directory";
import { errorToString } from "../utils/errorToString";
import { loadPdfFromBase64, renderPageToDataUrl } from "../utils/pdf";

type PdfLoaderResult = {
  pageCount: number;
  pageNames: string[];
  loading: boolean;
  error: string | null;
  getPageDataUrl: (pageIndex: number) => Promise<string>;
};

export function usePdfLoader(pdfPath: string | null): PdfLoaderResult {
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!pdfPath) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageCount(0);

    async function load() {
      try {
        const base64 = await readFileBase64(pdfPath as string);
        if (cancelled) return;

        const doc = await loadPdfFromBase64(base64);
        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setPageCount(doc.numPages);
      } catch (err) {
        if (!cancelled) {
          setError(errorToString(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfPath]);

  const getPageDataUrl = useCallback(async (pageIndex: number): Promise<string> => {
    const doc = pdfDocRef.current;
    if (!doc) {
      throw new Error("PDF document not loaded");
    }
    // PDF.js pages are 1-indexed
    return renderPageToDataUrl(doc, pageIndex + 1);
  }, []);

  const pageNames = Array.from({ length: pageCount }, (_, i) => `Page ${i + 1}`);

  return { pageCount, pageNames, loading, error, getPageDataUrl };
}
