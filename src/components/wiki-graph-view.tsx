"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphEdge, GraphNode } from "@/lib/wiki-graph";
import { resolveWikiNode } from "@/lib/wiki-links";
import { MarkdownView } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type GraphNodeObj = GraphNode & {
  id: string;
  x?: number;
  y?: number;
};

function linkEnds(link: {
  source?: string | number | { id?: string | number };
  target?: string | number | { id?: string | number };
}) {
  const source =
    typeof link.source === "object"
      ? String(link.source?.id)
      : String(link.source);
  const target =
    typeof link.target === "object"
      ? String(link.target?.id)
      : String(link.target);
  return { source, target };
}

async function fetchPageJson(path: string) {
  const res = await fetch("/api/wiki-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const preview = (await res.text()).slice(0, 120);
    throw new Error(
      `Unexpected response (${res.status}). Expected JSON, got: ${preview}`,
    );
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Page failed");
  return data as { content: string };
}

type Props = {
  initialNodeId?: string | null;
};

export function WikiGraphView({ initialNodeId = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const nodesRef = useRef<GraphNode[]>([]);
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const lastInitialNodeRef = useRef<string | null>(null);
  const [size, setSize] = useState({ w: 360, h: 420 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  nodesRef.current = nodes;

  const selected = useMemo(
    () => (selectedId ? nodes.find((n) => n.id === selectedId) || null : null),
    [nodes, selectedId],
  );

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      const a = String(edge.source);
      const b = String(edge.target);
      if (!map.has(a)) map.set(a, new Set());
      if (!map.has(b)) map.set(b, new Set());
      map.get(a)!.add(b);
      map.get(b)!.add(a);
    }
    return map;
  }, [edges]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/graph");
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Graph API returned non-JSON");
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Graph failed");
        if (cancelled) return;
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Graph failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected?.path) {
      setContent("");
      setContentError("");
      return;
    }
    let cancelled = false;
    async function loadPage() {
      setContentLoading(true);
      setContentError("");
      setContent("");
      try {
        const data = await fetchPageJson(selected!.path);
        if (!cancelled) setContent(data.content || "");
      } catch (err) {
        if (!cancelled) {
          setContentError(err instanceof Error ? err.message : "Page failed");
        }
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    }
    loadPage();
    return () => {
      cancelled = true;
    };
  }, [selected?.path]);

  const selectById = useCallback(
    (id: string, coords?: { x?: number; y?: number }) => {
      const node = resolveWikiNode(nodesRef.current, id);
      if (!node) {
        setContentError(`Node not found: ${id}`);
        return;
      }

      setSelectedId(node.id);
      setNeighbors(adjacency.get(node.id) || new Set());

      const cached = positionsRef.current.get(node.id);
      const x = typeof coords?.x === "number" ? coords.x : cached?.x;
      const y = typeof coords?.y === "number" ? coords.y : cached?.y;
      if (typeof x === "number" && typeof y === "number") {
        fgRef.current?.centerAt(x, y, 600);
        fgRef.current?.zoom(2.2, 600);
      }

      window.setTimeout(() => {
        detailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    },
    [adjacency],
  );

  useEffect(() => {
    if (!initialNodeId || loading || !nodes.length) return;
    if (lastInitialNodeRef.current === initialNodeId) return;
    const firstOpen = lastInitialNodeRef.current === null;
    lastInitialNodeRef.current = initialNodeId;
    // First open waits for force-graph layout; later URL changes open immediately.
    window.setTimeout(
      () => {
        selectById(initialNodeId);
      },
      firstOpen ? 400 : 0,
    );
  }, [initialNodeId, loading, nodes.length, selectById]);

  const selectNode = useCallback(
    (node: GraphNodeObj) => {
      selectById(String(node.id), { x: node.x, y: node.y });
    },
    [selectById],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setNeighbors(new Set());
    setContent("");
    setContentError("");
    fgRef.current?.zoomToFit(500, 40);
  }, []);

  const isNeighborLink = useCallback(
    (link: {
      source?: string | number | { id?: string | number };
      target?: string | number | { id?: string | number };
    }) => {
      if (!selectedId) return false;
      const { source, target } = linkEnds(link);
      return (
        (source === selectedId && neighbors.has(target)) ||
        (target === selectedId && neighbors.has(source))
      );
    },
    [neighbors, selectedId],
  );

  // Stable reference — recreating graphData on selection restarts the simulation.
  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: edges.map((e) => ({ ...e })),
    }),
    [nodes, edges],
  );

  const openWikiNode = useCallback(
    (id: string) => {
      const node = resolveWikiNode(nodesRef.current, id);
      const resolvedId = node?.id || id;
      lastInitialNodeRef.current = resolvedId;
      selectById(resolvedId);
      // Keep URL in sync without remounting the page / resetting the graph.
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("node", resolvedId);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [selectById],
  );

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && (
        <p className="text-sm text-muted-foreground">Loading graph…</p>
      )}

      <div
        ref={containerRef}
        className="h-[52vh] min-h-[280px] overflow-hidden rounded-2xl border border-border bg-muted/40"
      >
        {!loading && !error && (
          <ForceGraph2D
            ref={fgRef as never}
            width={size.w}
            height={size.h}
            graphData={graphData}
            nodeLabel="name"
            nodeRelSize={6}
            backgroundColor="#fafafa"
            cooldownTicks={80}
            onBackgroundClick={clearSelection}
            onNodeClick={(node) => selectNode(node as GraphNodeObj)}
            linkColor={(link) =>
              isNeighborLink(link)
                ? "rgba(23,23,23,0.85)"
                : selectedId
                  ? "rgba(23,23,23,0.08)"
                  : "rgba(23,23,23,0.22)"
            }
            linkWidth={(link) => (isNeighborLink(link) ? 2.4 : 0.8)}
            linkDirectionalParticles={(link) => (isNeighborLink(link) ? 2 : 0)}
            linkDirectionalParticleWidth={2}
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const n = node as GraphNodeObj;
              const id = String(n.id);
              if (typeof n.x === "number" && typeof n.y === "number") {
                positionsRef.current.set(id, { x: n.x, y: n.y });
              }
              const isSelected = selectedId === id;
              const isNear = neighbors.has(id);
              const label = String(n.name || id);
              const fontSize = (isSelected ? 13 : 11) / globalScale;
              const radius = isSelected ? 7 : isNear ? 5.5 : 4;

              ctx.beginPath();
              ctx.arc(n.x || 0, n.y || 0, radius, 0, 2 * Math.PI, false);
              if (isSelected) {
                ctx.fillStyle = "#171717";
                ctx.strokeStyle = "#171717";
                ctx.lineWidth = 1.5 / globalScale;
                ctx.fill();
                ctx.stroke();
              } else if (isNear) {
                ctx.fillStyle = "#171717";
                ctx.fill();
              } else {
                ctx.fillStyle = selectedId
                  ? "rgba(23,23,23,0.28)"
                  : "#171717";
                ctx.fill();
              }

              ctx.font = `${isSelected || isNear ? 600 : 400} ${fontSize}px Sans-Serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle =
                isSelected || isNear || !selectedId
                  ? "#171717"
                  : "rgba(23,23,23,0.35)";
              ctx.fillText(label, n.x || 0, (n.y || 0) + radius + 3);
            }}
          />
        )}
      </div>

      {selected && (
        <div
          ref={detailsRef}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Node
              </p>
              <h2 className="text-2xl font-semibold leading-none tracking-tight">
                {selected.name}
              </h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {selected.path}
              </p>
              {neighbors.size > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {neighbors.size} neighboring topics highlighted
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              onClick={clearSelection}
              aria-label="Close details"
            >
              <X className="size-4" />
            </Button>
          </div>

          {contentLoading && (
            <p className="text-sm text-muted-foreground">Loading content…</p>
          )}
          {contentError && (
            <p className="text-sm text-destructive">{contentError}</p>
          )}
          {!contentLoading && !contentError && content && (
            <MarkdownView
              content={content}
              nodes={nodes}
              onWikiNode={openWikiNode}
            />
          )}
          {!contentLoading && !contentError && !content && (
            <p className="text-sm text-muted-foreground">
              No content available for this node.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
