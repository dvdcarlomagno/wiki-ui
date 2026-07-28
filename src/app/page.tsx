"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, LogOut, Network, Plus } from "lucide-react";
import { Composer, type RunLaunch } from "@/components/composer";
import {
  ConversationDrawer,
  ConversationDrawerButton,
} from "@/components/conversation-drawer";
import { RunStatus } from "@/components/run-status";
import { Button } from "@/components/ui/button";
import {
  appendExchangeToActive,
  getActiveConversationId,
  getConversation,
  listConversationsNewestFirst,
  MAX_EXCHANGES_PER_CONVERSATION,
  priorTurnsForApi,
  setActiveConversationId,
  startNewConversation,
  type Conversation,
  type ConversationExchange,
} from "@/lib/conversations";
import type { GraphNode } from "@/lib/wiki-graph";

function exchangeToRun(exchange: ConversationExchange): RunLaunch {
  return {
    action: "query",
    mode: "llm",
    question: exchange.question,
    answer: exchange.answer,
    model: exchange.model,
    warning: exchange.warning,
  };
}

export default function HomePage() {
  const router = useRouter();
  const [run, setRun] = useState<RunLaunch | null>(null);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wikiNodes, setWikiNodes] = useState<GraphNode[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  function refreshFromStorage() {
    const list = listConversationsNewestFirst();
    const id = getActiveConversationId();
    setConversations(list);
    setActiveId(id);
    return { list, id, active: getConversation(id) };
  }

  useEffect(() => {
    refreshFromStorage();
    setHydrated(true);
  }, []);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );
  const exchanges = active?.exchanges ?? [];
  const chatMode = hydrated && exchanges.length > 0;
  const atCap = exchanges.length >= MAX_EXCHANGES_PER_CONVERSATION;
  const priorTurns = priorTurnsForApi(active);

  useEffect(() => {
    if (!chatMode) return;
    let cancelled = false;
    fetch("/api/graph")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || cancelled) return;
        setWikiNodes(data.nodes || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [chatMode]);

  useEffect(() => {
    if (!chatMode) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMode, exchanges.length, activeId, run?.action]);

  function handleNewChat() {
    startNewConversation();
    setActiveId(null);
    setRun(null);
    setError("");
    setDrawerOpen(false);
    refreshFromStorage();
  }

  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    setActiveId(id);
    setRun(null);
    setError("");
    refreshFromStorage();
  }

  function handleLaunched(next: RunLaunch) {
    setRun(next);
    if (next.action !== "query" || !next.question || !next.answer) return;
    try {
      const { conversation } = appendExchangeToActive({
        question: next.question,
        answer: next.answer,
        model: next.model,
        warning: next.warning,
      });
      setActiveId(conversation.id);
      setConversations(listConversationsNewestFirst());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chat");
    }
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  const composer = (
    <Composer
      onLaunched={handleLaunched}
      onError={setError}
      compact={chatMode}
      queryOnly={chatMode}
      queryDisabled={atCap}
      priorTurns={priorTurns}
    />
  );

  return (
    <main
      className={`mx-auto flex w-full max-w-lg flex-col px-4 pt-4 ${
        chatMode ? "h-dvh overflow-hidden" : "min-h-dvh"
      }`}
    >
      <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] uppercase text-muted-foreground">
            wiki-ui
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight">
            Wiki
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <ConversationDrawerButton
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="New chat"
            onClick={handleNewChat}
          >
            <Plus className="size-5" />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Ingest history"
          >
            <Link href="/history">
              <History className="size-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Graph view"
          >
            <Link href="/graph">
              <Network className="size-5" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <ConversationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
      />

      {!hydrated ? (
        <div className="flex-1" aria-hidden />
      ) : !chatMode ? (
        <div className="flex flex-1 flex-col justify-center space-y-4 pb-6">
          {composer}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {run?.action === "ingest" && <RunStatus run={run} />}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4">
            {exchanges.map((exchange) => (
              <RunStatus
                key={exchange.id}
                run={exchangeToRun(exchange)}
                wikiNodes={wikiNodes}
              />
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div ref={threadEndRef} />
          </div>
          <div className="shrink-0 border-t border-border bg-background/92 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-[16px]">
            {composer}
          </div>
        </>
      )}
    </main>
  );
}
