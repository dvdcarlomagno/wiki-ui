"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InjectionHistoryView } from "@/components/injection-history";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-6 pt-4">
      <header className="mb-3 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href="/" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold leading-none">Ingestions</h1>
      </header>
      <InjectionHistoryView />
    </main>
  );
}
