import type { GraphNode } from "@/lib/wiki-graph";

export function slugifyWikiName(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\.md$/i, "");
}

export function resolveWikiNode(
  nodes: GraphNode[],
  ref: string,
): GraphNode | undefined {
  const raw = ref.trim();
  if (!raw) return undefined;

  const byId = nodes.find((n) => n.id === raw);
  if (byId) return byId;

  const slug = slugifyWikiName(raw.replace(/^wiki\//, ""));
  return (
    nodes.find((n) => n.id === slug) ||
    nodes.find((n) => n.id.endsWith(`/${slug}`)) ||
    nodes.find((n) => n.path === raw || n.path === `wiki/${slug}.md`) ||
    nodes.find((n) => n.name.toLowerCase() === raw.toLowerCase())
  );
}

/** Safe in-app href for a wiki node (passes react-markdown urlTransform). */
export function wikiNodeHref(nodeId: string) {
  return `/graph?node=${encodeURIComponent(nodeId)}`;
}

/** Extract node id from wiki-node:// or /graph?node= hrefs. */
export function wikiNodeIdFromHref(href?: string | null): string | null {
  if (!href) return null;

  if (href.startsWith("wiki-node://")) {
    return decodeURIComponent(href.slice("wiki-node://".length));
  }

  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = new URL(href, base);
    if (url.pathname === "/graph") {
      const node = url.searchParams.get("node");
      return node ? decodeURIComponent(node) : null;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Turn [[Page]] and relative .md links into /graph?node= hrefs for the UI. */
export function rewriteWikiLinks(content: string, nodes: GraphNode[]) {
  let out = content.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const [title, label] = inner.split("|");
    const name = title.trim();
    const display = (label || name).trim();
    const node = resolveWikiNode(nodes, name);
    const id = node?.id || slugifyWikiName(name);
    return `[${display}](${wikiNodeHref(id)})`;
  });

  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (full, label: string, href: string) => {
      const clean = href.split("#")[0].trim();
      if (
        !clean ||
        clean.startsWith("http") ||
        clean.startsWith("wiki-node://") ||
        clean.startsWith("/graph")
      ) {
        return full;
      }
      if (
        !clean.endsWith(".md") &&
        !clean.startsWith("wiki/") &&
        !clean.includes("/")
      ) {
        // bare page-ish refs still OK
      }
      const node = resolveWikiNode(nodes, clean);
      if (!node) return full;
      return `[${label}](${wikiNodeHref(node.id)})`;
    },
  );

  return out;
}
