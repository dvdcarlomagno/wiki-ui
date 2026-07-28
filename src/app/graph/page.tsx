"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WikiGraphView } from "@/components/wiki-graph-view";
import { Button } from "@/components/ui/button";

function GraphInner() {
  const params = useSearchParams();
  const initialNodeId = params.get("node");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-6 pt-4">
      <header className="mb-3 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href="/" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold leading-none">Graph</h1>
      </header>
      <WikiGraphView initialNodeId={initialNodeId} />
    </main>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm">Loading…</main>}>
      <GraphInner />
    </Suspense>
  );
}
