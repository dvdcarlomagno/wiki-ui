"use client";

import { useRef, useState } from "react";
import { Paperclip, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { IngestSlider } from "@/components/ingest-slider";
import type { PriorTurn } from "@/lib/conversations";

export type RunLaunch = {
  action: "ingest" | "query";
  mode: "agent" | "llm";
  agentId?: string;
  runId?: string;
  url?: string;
  question?: string;
  answer?: string;
  model?: string;
  warning?: string;
};

type Props = {
  onLaunched: (run: RunLaunch) => void;
  onError: (message: string) => void;
  /** Compact composer for fixed-bottom chat layout */
  compact?: boolean;
  /** Hide Ingest after first query in a chat */
  queryOnly?: boolean;
  /** Cap reached — Query disabled */
  queryDisabled?: boolean;
  /** Prior turns in the active conversation (for OpenRouter memory) */
  priorTurns?: PriorTurn[];
};

export function Composer({
  onLaunched,
  onError,
  compact = false,
  queryOnly = false,
  queryDisabled = false,
  priorTurns = [],
}: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"ingest" | "query" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(action: "ingest" | "query") {
    if (action === "query" && queryDisabled) {
      onError("5-exchange limit reached. Start a new chat.");
      return;
    }
    if (!text.trim() && files.length === 0) {
      onError("Add text or an attachment");
      return;
    }
    if (action === "query" && !text.trim()) {
      onError("Query requires a text question");
      return;
    }
    setBusy(action);
    onError("");
    try {
      const body = new FormData();
      body.set("text", text);
      for (const file of files) body.append("files", file);
      if (action === "query" && priorTurns.length > 0) {
        body.set("history", JSON.stringify(priorTurns));
      }

      const res = await fetch(`/api/${action}`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      if (action === "query") {
        onLaunched({
          action: "query",
          mode: "llm",
          question: text.trim(),
          answer: data.answer,
          model: data.model,
          warning: data.warning,
        });
      } else {
        onLaunched({
          action: "ingest",
          mode: "agent",
          agentId: data.agentId,
          runId: data.runId,
          url: data.url,
          warning: data.warning,
        });
      }
      setText("");
      setFiles([]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-3 shadow-sm backdrop-blur-[16px]">
      {queryDisabled && (
        <p className="mb-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
          You have reached 5 exchanges in this chat. Use{" "}
          <span className="font-medium">+</span> to start a new conversation.
        </p>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, i) => (
            <Badge
              key={`${file.name}-${i}`}
              variant="secondary"
              className="gap-1 border border-border bg-background pr-1 text-foreground"
            >
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          queryOnly
            ? "Continue the conversation…"
            : "Message, URL, or question…"
        }
        disabled={queryDisabled}
        className={`${compact ? "min-h-[56px]" : "min-h-[96px]"} resize-none border-0 bg-transparent p-1 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-60`}
      />

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.md,.txt,.pdf,.csv,.json"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {!queryOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full text-foreground hover:bg-muted"
            onClick={() => inputRef.current?.click()}
            aria-label="Attach file"
            disabled={!!busy}
          >
            <Paperclip className="size-5" />
          </Button>
        )}
        {!queryOnly && (
          <IngestSlider
            disabled={!!busy}
            busy={busy === "ingest"}
            onConfirm={() => submit("ingest")}
          />
        )}
        <Button
          type="button"
          size="icon"
          className="ml-auto size-11 shrink-0 rounded-full"
          disabled={!!busy || queryDisabled}
          onClick={() => submit("query")}
          aria-label={busy === "query" ? "Query in progress" : "Query"}
        >
          <Search className="size-5" />
        </Button>
      </div>
    </div>
  );
}
