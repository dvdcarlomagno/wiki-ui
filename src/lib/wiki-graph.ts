import { getFileContent, listWikiMarkdownFiles } from "@/lib/github";

export type GraphNode = {
  id: string;
  name: string;
  path: string;
};

export type GraphEdge = {
  source: string;
  target: string;
};

function slugFromPath(filePath: string) {
  return filePath
    .replace(/^wiki\//, "")
    .replace(/\.md$/, "")
    .toLowerCase();
}

function titleFromPath(filePath: string) {
  const base = filePath.replace(/^wiki\//, "").replace(/\.md$/, "");
  if (filePath === "index.md") return "Index";
  return base
    .split("/")
    .pop()!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractLinks(markdown: string) {
  const links = new Set<string>();
  const wikiLink = /\[\[([^\]]+)\]\]/g;
  const mdLink = /\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = wikiLink.exec(markdown))) {
    const name = m[1].split("|")[0].trim();
    links.add(
      name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/\.md$/, ""),
    );
  }
  while ((m = mdLink.exec(markdown))) {
    const href = m[1].split("#")[0].trim();
    if (!href || href.startsWith("http")) continue;
    const cleaned = href
      .replace(/^\.\//, "")
      .replace(/^wiki\//, "")
      .replace(/\.md$/, "")
      .toLowerCase();
    if (cleaned) links.add(cleaned);
  }
  return [...links];
}

export async function buildWikiGraph(repoUrl: string) {
  const paths = await listWikiMarkdownFiles(repoUrl);
  const nodes: GraphNode[] = paths.map((p) => ({
    id: slugFromPath(p),
    name: titleFromPath(p),
    path: p,
  }));
  const idSet = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const p of paths) {
    const content = await getFileContent(repoUrl, p);
    if (!content) continue;
    const source = slugFromPath(p);
    for (const target of extractLinks(content)) {
      const resolved =
        [...idSet].find((id) => id === target || id.endsWith(`/${target}`)) ||
        target;
      if (!idSet.has(resolved) || resolved === source) continue;
      const key = `${source}->${resolved}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ source, target: resolved });
    }
  }

  return { nodes, edges };
}
