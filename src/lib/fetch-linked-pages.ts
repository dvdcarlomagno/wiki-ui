const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;
const MAX_URLS = 5;
const MAX_CHARS_PER_PAGE = 14_000;
const FETCH_TIMEOUT_MS = 12_000;

export type LinkedPage = {
  url: string;
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
};

export function extractUrls(text: string): string[] {
  const found = text.match(URL_RE) || [];
  const cleaned = found.map((u) => u.replace(/[.,;:!?]+$/g, ""));
  return [...new Set(cleaned)].slice(0, MAX_URLS);
}

function decodeEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function htmlToText(html: string) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const titleMatch = withoutNoise.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeEntities(titleMatch[1].replace(/\s+/g, " ").trim())
    : undefined;

  const text = decodeEntities(
    withoutNoise
      .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );

  return { title, text };
}

async function fetchOne(url: string): Promise<LinkedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "wiki-ui-link-reader/1.0",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { url, ok: false, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    if (
      contentType.includes("text/plain") ||
      contentType.includes("markdown") ||
      contentType.includes("json")
    ) {
      return {
        url,
        ok: true,
        text: raw.slice(0, MAX_CHARS_PER_PAGE),
      };
    }
    const { title, text } = htmlToText(raw);
    if (!text.trim()) {
      return { url, ok: false, error: "Empty page body" };
    }
    return {
      url,
      ok: true,
      title,
      text: text.slice(0, MAX_CHARS_PER_PAGE),
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Fetch timed out"
          : err.message
        : "Fetch failed";
    return { url, ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch unique http(s) links found across the question and any extra text sources (e.g. attachments). */
export async function fetchLinkedPages(
  ...sources: Array<string | null | undefined>
): Promise<LinkedPage[]> {
  const urls = [
    ...new Set(sources.flatMap((source) => extractUrls(source || ""))),
  ].slice(0, MAX_URLS);
  if (urls.length === 0) return [];
  return Promise.all(urls.map((url) => fetchOne(url)));
}

export function formatLinkedPages(pages: LinkedPage[]): string {
  if (pages.length === 0) return "";
  return pages
    .map((page) => {
      if (!page.ok) {
        return `### ${page.url}\n\n(fetch failed: ${page.error || "unknown"})\n`;
      }
      const heading = page.title
        ? `### ${page.title}\n${page.url}`
        : `### ${page.url}`;
      return `${heading}\n\n${page.text}\n`;
    })
    .join("\n---\n\n");
}
