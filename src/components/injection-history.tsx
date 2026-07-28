"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type HistoryCommit = {
  sha: string;
  message: string;
  date: string | null;
  url: string;
  author: string | null;
};

function formatCommitDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function InjectionHistoryView() {
  const [commits, setCommits] = useState<HistoryCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/history", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "History failed");
        if (!cancelled) {
          setCommits(Array.isArray(data.commits) ? data.commits : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "History failed");
          setCommits([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="Recent ingestions"
      className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur-[16px]"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          History
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Recent ingestions, newest first
        </p>
      </div>

      <div className="max-h-[min(70dvh,36rem)] overflow-y-auto overscroll-contain px-4 py-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {!loading && error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && commits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No ingestions yet.
          </p>
        )}
        {!loading && !error && commits.length > 0 && (
          <ul className="space-y-3">
            {commits.map((commit) => (
              <li key={commit.sha} className="min-w-0">
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "block min-w-0 rounded-lg outline-none transition-colors",
                    "hover:bg-muted/70",
                    "focus-visible:ring-2 focus-visible:ring-ring/50",
                    "px-1 py-1",
                  )}
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {commit.message}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[formatCommitDate(commit.date), commit.author]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
