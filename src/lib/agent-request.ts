import type { CursorImage } from "@/lib/cursor-agents";

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const TEXT_EXT = /\.(md|txt|csv|json|tsv|log|html|htm|xml|yaml|yml|ts|tsx|js|jsx|py|rs|go|css|svg)$/i;
const MAX_TEXT_CHARS = 24_000;

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

export type ParsedAgentForm = {
  text: string;
  repoUrl: string;
  images: CursorImage[];
  imageNames: string[];
  textAttachments: TextAttachment[];
  binaryAttachments: BinaryAttachment[];
  /** Ingest-oriented notes (kept for Cursor agent prompts). */
  attachmentNotes: string;
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
  // Reject obvious binary (NUL bytes).
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

export async function parseAgentForm(formData: FormData): Promise<ParsedAgentForm> {
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
  const attachmentNotes: string[] = [];

  for (const file of files) {
    const mime = file.type || "application/octet-stream";
    const buf = Buffer.from(await file.arrayBuffer());

    if (IMAGE_MIME.has(mime) && images.length < 5) {
      if (buf.byteLength > 15 * 1024 * 1024) {
        throw new Error(`Image ${file.name} exceeds 15MB`);
      }
      images.push({
        data: buf.toString("base64"),
        mimeType: mime as CursorImage["mimeType"],
      });
      imageNames.push(file.name);
      attachmentNotes.push(
        `- image: ${file.name} (${mime}) [attached to prompt]`,
      );
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
          "  Store under raw/ or raw/assets/ as appropriate.",
          "  Content/preview:",
          "  ```",
          content,
          "  ```",
        ].join("\n"),
      );
      continue;
    }

    const note =
      mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? "PDF bytes not extracted in query mode — paste text or ingest the file"
        : "binary content not extracted — describe it in text or ingest the file";
    binaryAttachments.push({
      name: file.name,
      mime,
      bytes: buf.byteLength,
      note,
    });
    attachmentNotes.push(
      [
        `- file: ${file.name} (${mime}, ${buf.byteLength} bytes)`,
        "  Store under raw/ or raw/assets/ as appropriate.",
        `  Content/preview: (${note})`,
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
    attachmentNotes: attachmentNotes.join("\n"),
  };
}
