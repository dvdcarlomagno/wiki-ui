import type { CursorImage } from "@/lib/cursor-agents";
import { extractPdfText } from "@/lib/pdf-text";

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const TEXT_EXT =
  /\.(md|txt|csv|json|tsv|log|html|htm|xml|yaml|yml|ts|tsx|js|jsx|py|rs|go|css|svg)$/i;
const MAX_TEXT_CHARS = 24_000;
const MAX_PDF_CHARS = 80_000;
/** Keep under Next middleware/proxy body limits and GitHub Contents API comfort zone. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type TextAttachment = {
  name: string;
  mime: string;
  content: string;
  truncated: boolean;
};

export type BinaryAttachment = {
  name: string;
  mime: string;
  bytes: number;
  note: string;
};

/** Original bytes to commit into the wiki repo before launching a Cursor agent. */
export type PendingUpload = {
  name: string;
  mime: string;
  buf: Buffer;
  /** text → raw/; asset → raw/assets/ */
  kind: "text" | "asset";
};

export type ParsedAgentForm = {
  text: string;
  repoUrl: string;
  images: CursorImage[];
  imageNames: string[];
  textAttachments: TextAttachment[];
  binaryAttachments: BinaryAttachment[];
  pendingUploads: PendingUpload[];
  /** Ingest-oriented notes (kept for Cursor agent prompts). */
  attachmentNotes: string;
};

export type ParseAgentFormOptions = {
  /** query = extract or fail; ingest = extract when possible + stage originals. */
  purpose?: "ingest" | "query";
};

export function defaultWikiRepoUrl() {
  const url = process.env.DEFAULT_WIKI_REPO_URL?.trim();
  if (!url) {
    throw new Error(
      "DEFAULT_WIKI_REPO_URL is not configured. Set it to https://github.com/OWNER/wiki-repo",
    );
  }
  return url;
}

function isPdfFile(name: string, mime: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function isTextFile(name: string, mime: string) {
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml")
  ) {
    return true;
  }
  return TEXT_EXT.test(name);
}

function looksLikeUtf8Text(buf: Buffer) {
  if (buf.byteLength === 0) return false;
  const sample = buf.subarray(0, Math.min(buf.byteLength, 2048));
  if (sample.includes(0)) return false;
  try {
    const decoded = sample.toString("utf8");
    const replacement = (decoded.match(/\uFFFD/g) || []).length;
    return replacement / Math.max(decoded.length, 1) < 0.05;
  } catch {
    return false;
  }
}

export function formatQueryAttachments(form: ParsedAgentForm): string {
  const parts: string[] = [];

  for (const file of form.textAttachments) {
    parts.push(
      [
        `### file: ${file.name} (${file.mime})`,
        file.truncated ? "(truncated)" : "",
        "",
        "```",
        file.content,
        "```",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  for (const image of form.imageNames) {
    parts.push(
      `### image: ${image}\n\n(image bytes attached to the multimodal prompt — evaluate visually)`,
    );
  }

  for (const file of form.binaryAttachments) {
    parts.push(
      `### file: ${file.name} (${file.mime}, ${file.bytes} bytes)\n\n(${file.note})`,
    );
  }

  return parts.join("\n\n---\n\n");
}

export function attachmentUrlSourceText(form: ParsedAgentForm): string {
  return form.textAttachments.map((f) => f.content).join("\n");
}

export function stagingPathForUpload(upload: PendingUpload, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const safe = upload.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const base = safe || "attachment";
  return upload.kind === "text"
    ? `raw/${day}-${base}`
    : `raw/assets/${day}-${base}`;
}

export async function parseAgentForm(
  formData: FormData,
  options?: ParseAgentFormOptions,
): Promise<ParsedAgentForm> {
  const purpose = options?.purpose ?? "ingest";
  const text = String(formData.get("text") || "").trim();
  const repoUrl = defaultWikiRepoUrl();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && files.length === 0) {
    throw new Error("Provide text and/or at least one attachment");
  }

  const images: CursorImage[] = [];
  const imageNames: string[] = [];
  const textAttachments: TextAttachment[] = [];
  const binaryAttachments: BinaryAttachment[] = [];
  const pendingUploads: PendingUpload[] = [];
  const attachmentNotes: string[] = [];

  for (const file of files) {
    const mime = file.type || "application/octet-stream";
    const buf = Buffer.from(await file.arrayBuffer());

    if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `Attachment ${file.name} exceeds 10MB. Use a smaller file or paste the text.`,
      );
    }

    if (IMAGE_MIME.has(mime) && images.length < 5) {
      images.push({
        data: buf.toString("base64"),
        mimeType: mime as CursorImage["mimeType"],
      });
      imageNames.push(file.name);
      attachmentNotes.push(
        `- image: ${file.name} (${mime}) [attached to prompt]`,
      );
      if (purpose === "ingest") {
        pendingUploads.push({ name: file.name, mime, buf, kind: "asset" });
      }
      continue;
    }

    if (isPdfFile(file.name, mime)) {
      const { text: pdfText, totalPages } = await extractPdfText(buf);
      const truncated = pdfText.length > MAX_PDF_CHARS;
      const content = truncated ? pdfText.slice(0, MAX_PDF_CHARS) : pdfText;
      textAttachments.push({
        name: file.name,
        mime: mime || "application/pdf",
        content,
        truncated,
      });
      attachmentNotes.push(
        [
          `- file: ${file.name} (application/pdf, ${buf.byteLength} bytes, ${totalPages} pages)`,
          "  Store under raw/assets/ as appropriate (original will be staged when ingesting).",
          truncated
            ? `  Extracted text (truncated to ${MAX_PDF_CHARS} chars):`
            : "  Extracted text:",
          "  ```",
          content,
          "  ```",
        ].join("\n"),
      );
      if (purpose === "ingest") {
        pendingUploads.push({ name: file.name, mime, buf, kind: "asset" });
      }
      continue;
    }

    if (isTextFile(file.name, mime) || looksLikeUtf8Text(buf)) {
      const full = buf.toString("utf8");
      const truncated = full.length > MAX_TEXT_CHARS;
      const content = truncated ? full.slice(0, MAX_TEXT_CHARS) : full;
      textAttachments.push({
        name: file.name,
        mime,
        content,
        truncated,
      });
      attachmentNotes.push(
        [
          `- file: ${file.name} (${mime}, ${buf.byteLength} bytes)`,
          "  Store under raw/ as appropriate.",
          "  Content/preview:",
          "  ```",
          content,
          "  ```",
        ].join("\n"),
      );
      if (purpose === "ingest") {
        pendingUploads.push({ name: file.name, mime, buf, kind: "text" });
      }
      continue;
    }

    // Unsupported binary for LLM query — fail closed (no metadata-only answers).
    if (purpose === "query") {
      throw new Error(
        `Cannot read attachment "${file.name}" (${mime}) for query. Use text, markdown, CSV, JSON, PDF with selectable text, or an image — or ingest the file first.`,
      );
    }

    // Ingest: Cursor API has no binary file field — stage into the wiki repo instead.
    pendingUploads.push({ name: file.name, mime, buf, kind: "asset" });
    attachmentNotes.push(
      [
        `- file: ${file.name} (${mime}, ${buf.byteLength} bytes)`,
        "  Binary attachment — original bytes will be uploaded to raw/assets/ before the agent runs.",
        "  Read the staged file from the repo; do not invent binary contents.",
      ].join("\n"),
    );
  }

  return {
    text,
    repoUrl,
    images,
    imageNames,
    textAttachments,
    binaryAttachments,
    pendingUploads,
    attachmentNotes: attachmentNotes.join("\n"),
  };
}
