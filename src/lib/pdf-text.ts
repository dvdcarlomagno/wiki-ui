import { extractText, getDocumentProxy } from "unpdf";

/** Reject empty/whitespace-only extracts; short real docs are allowed. */
const MIN_EXTRACTED_CHARS = 10;

export type PdfExtractResult = {
  text: string;
  totalPages: number;
};

/**
 * Extract plain text from a PDF buffer. Throws if the file cannot be read
 * or yields no usable text (e.g. scanned/image-only PDFs).
 */
export async function extractPdfText(buf: Buffer): Promise<PdfExtractResult> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const cleaned = String(text || "")
      .replace(/\u0000/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (cleaned.length < MIN_EXTRACTED_CHARS) {
      throw new Error(
        "PDF has no extractable text (scanned/image-only). Paste the text or use a text PDF.",
      );
    }

    return { text: cleaned, totalPages: totalPages || 0 };
  } catch (err) {
    if (
      err instanceof Error &&
      /no extractable text|scanned\/image-only/i.test(err.message)
    ) {
      throw err;
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read PDF text: ${detail}`);
  }
}
