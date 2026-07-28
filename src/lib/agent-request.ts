import type { CursorImage } from "@/lib/cursor-agents";

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function defaultWikiRepoUrl() {
  const url = process.env.DEFAULT_WIKI_REPO_URL?.trim();
  if (!url) {
    throw new Error(
      "DEFAULT_WIKI_REPO_URL is not configured. Set it to https://github.com/OWNER/wiki-repo",
    );
  }
  return url;
}

export async function parseAgentForm(formData: FormData) {
  const text = String(formData.get("text") || "").trim();
  const repoUrl = defaultWikiRepoUrl();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && files.length === 0) {
    throw new Error("Provide text and/or at least one attachment");
  }

  const images: CursorImage[] = [];
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
      attachmentNotes.push(`- image: ${file.name} (${mime}) [attached to prompt]`);
    } else {
      const preview =
        mime.startsWith("text/") || file.name.endsWith(".md")
          ? buf.toString("utf8").slice(0, 12000)
          : `(binary ${mime}, ${buf.byteLength} bytes)`;
      attachmentNotes.push(
        [
          `- file: ${file.name} (${mime}, ${buf.byteLength} bytes)`,
          "  Store under raw/ or raw/assets/ as appropriate.",
          "  Content/preview:",
          "  ```",
          preview,
          "  ```",
        ].join("\n"),
      );
    }
  }

  return { text, repoUrl, images, attachmentNotes: attachmentNotes.join("\n") };
}
