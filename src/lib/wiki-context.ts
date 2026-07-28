import {
  getDefaultBranch,
  getFileContent,
  listWikiMarkdownFiles,
} from "@/lib/github";

const MAX_CHARS = 90_000;
const MAX_PAGES = 18;

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .filter((t) => t.length > 2);
}

function scorePath(path: string, queryTokens: string[]) {
  const hay = path.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (hay.includes(t)) score += 3;
  }
  if (path === "index.md" || path.endsWith("/overview.md")) score += 8;
  return score;
}

function scoreContent(content: string, queryTokens: string[]) {
  const hay = content.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (hay.includes(t)) score += 1;
  }
  return score;
}

export async function buildWikiContext(repoUrl: string, question: string) {
  const ref = await getDefaultBranch(repoUrl);
  const paths = await listWikiMarkdownFiles(repoUrl, ref);
  const queryTokens = tokenize(question);

  const ranked = paths
    .map((path) => ({ path, score: scorePath(path, queryTokens) }))
    .sort((a, b) => b.score - a.score);

  const selected: string[] = [];
  for (const item of ranked) {
    if (selected.length >= MAX_PAGES) break;
    selected.push(item.path);
  }
  // Always include index if present
  if (paths.includes("index.md") && !selected.includes("index.md")) {
    selected.unshift("index.md");
  }

  const chunks: { path: string; content: string; score: number }[] = [];
  for (const path of selected) {
    const content = await getFileContent(repoUrl, path, ref);
    if (!content?.trim()) continue;
    chunks.push({
      path,
      content,
      score: scorePath(path, queryTokens) + scoreContent(content, queryTokens),
    });
  }

  chunks.sort((a, b) => b.score - a.score);

  const parts: string[] = [];
  let used = 0;
  for (const chunk of chunks) {
    const block = `### ${chunk.path}\n\n${chunk.content.trim()}\n`;
    if (used + block.length > MAX_CHARS) {
      const remaining = MAX_CHARS - used;
      if (remaining > 500) {
        parts.push(block.slice(0, remaining) + "\n…\n");
      }
      break;
    }
    parts.push(block);
    used += block.length;
  }

  return {
    ref,
    pageCount: chunks.length,
    context: parts.join("\n---\n\n") || "(wiki vuota o non leggibile)",
  };
}
