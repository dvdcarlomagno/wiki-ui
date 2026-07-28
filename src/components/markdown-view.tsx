"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  rewriteWikiLinks,
  wikiNodeIdFromHref,
} from "@/lib/wiki-links";
import type { GraphNode } from "@/lib/wiki-graph";

type Props = {
  content: string;
  nodes?: GraphNode[];
  onWikiNode?: (nodeId: string) => void;
};

function urlTransform(url: string) {
  if (url.startsWith("wiki-node://")) return url;
  return defaultUrlTransform(url);
}

export function MarkdownView({ content, nodes = [], onWikiNode }: Props) {
  const prepared = rewriteWikiLinks(content, nodes);

  return (
    <div className="wiki-md prose prose-neutral max-w-none text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 text-2xl font-semibold leading-tight tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 text-xl font-semibold leading-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-sm leading-relaxed text-foreground/90">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => {
            const wikiId = wikiNodeIdFromHref(href);
            if (wikiId && onWikiNode) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onWikiNode(wikiId);
                  }}
                  className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:bg-primary/15"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          code: ({ className, children }) => {
            const inline = !className;
            if (inline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
                  {children}
                </code>
              );
            }
            return (
              <code className="block overflow-x-auto rounded-xl bg-muted p-3 text-xs">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-primary pl-3 text-sm italic text-foreground/70">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 align-top">
              {children}
            </td>
          ),
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
