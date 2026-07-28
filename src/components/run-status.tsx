"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { RunLaunch } from "@/components/composer";
import { MarkdownView } from "@/components/markdown-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GraphNode } from "@/lib/wiki-graph";

function extractStatus(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "unknown";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.status === "string") return obj.status;
  if (obj.run && typeof obj.run === "object") {
    const run = obj.run as Record<string, unknown>;
    if (typeof run.status === "string") return run.status;
  }
  return "unknown";
}

function extractSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  const nestedResult =
    obj.result && typeof obj.result === "object"
      ? (obj.result as Record<string, unknown>)
      : null;
  const candidates = [
    obj.text,
    nestedResult?.text,
    obj.summary,
    typeof obj.result === "string" ? obj.result : null,
    obj.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

function looksLikeMarkdown(text: string) {
  return /(\*\*|__|#{1,3}\s|^\s*[-*]\s|^\s*\d+\.\s|\[\[)/m.test(text);
}

type Props = {
  run: RunLaunch | null;
  /** Shared wiki nodes; when omitted, fetched once for this card */
  wikiNodes?: GraphNode[];
};

export function RunStatus({ run, wikiNodes }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState("idle");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [nodes, setNodes] = useState<GraphNode[]>(wikiNodes ?? []);

  useEffect(() => {
    if (wikiNodes) setNodes(wikiNodes);
  }, [wikiNodes]);

  useEffect(() => {
    if (!run) return;

    if (run.mode === "llm") {
      setStatus("FINISHED");
      setDetail(run.answer || "");
      setError("");
      return;
    }

    if (!run.agentId || !run.runId) return;

    let cancelled = false;
    let ticks = 0;

    async function poll() {
      ticks += 1;
      try {
        const res = await fetch(`/api/runs/${run!.agentId}/${run!.runId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status failed");
        if (cancelled) return;
        const next = extractStatus(data.run) || extractStatus(data.agent);
        setStatus(next);
        setDetail(extractSummary(data.run) || extractSummary(data.agent));
        setError(data.runError || "");
        const done = /COMPLETE|FAILED|CANCEL|ERROR|FINISHED|SUCCESS/i.test(next);
        if (!done && ticks < 90) {
          window.setTimeout(poll, 4000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Poll failed");
        }
      }
    }

    setStatus("starting");
    setDetail("");
    setError("");
    poll();
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => {
    if (wikiNodes || !detail || !looksLikeMarkdown(detail)) return;
    let cancelled = false;
    fetch("/api/graph")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return;
        if (!cancelled) setNodes(data.nodes || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [detail, wikiNodes]);

  if (!run) return null;

  const renderMarkdown = Boolean(detail && looksLikeMarkdown(detail));

  return (
    <Card className="w-full min-w-0 shrink-0 rounded-2xl border border-border bg-card/90 py-3 shadow-sm ring-0 backdrop-blur-[16px]">
      <CardHeader className="space-y-2 px-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base capitalize">{run.action}</CardTitle>
          <Badge variant="outline">{status}</Badge>
        </div>
        {run.model && (
          <p className="text-xs text-muted-foreground">{run.model}</p>
        )}
        {run.question && (
          <div className="min-w-0 rounded-xl bg-muted px-3 py-2">
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
              Question
            </p>
            <p className="mt-1 break-words text-sm leading-snug text-foreground">
              {run.question}
            </p>
          </div>
        )}
        {run.warning && (
          <p className="break-words text-xs text-amber-700 dark:text-amber-400">
            {run.warning}
          </p>
        )}
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-3 text-sm">
        {run.url && (
          <a
            href={run.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 break-all text-foreground underline-offset-4 hover:underline"
          >
            Open Cursor agent <ExternalLink className="size-3.5 shrink-0" />
          </a>
        )}
        {error && <p className="break-words text-destructive">{error}</p>}
        {detail && renderMarkdown && (
          <div className="min-w-0 overflow-hidden rounded-xl bg-muted p-3">
            <MarkdownView
              content={detail}
              nodes={nodes}
              onWikiNode={(id) =>
                router.push(`/graph?node=${encodeURIComponent(id)}`)
              }
            />
          </div>
        )}
        {detail && !renderMarkdown && (
          <div className="whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-sm leading-relaxed text-foreground">
            {detail}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
