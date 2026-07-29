"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Paperclip, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ComposerAura } from "@/components/composer-aura";
import { IngestSlider } from "@/components/ingest-slider";
import type { PriorTurn } from "@/lib/conversations";

function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const fromFiles = dt.files?.length ? Array.from(dt.files) : [];
  if (fromFiles.length) return fromFiles;
  const fromItems: File[] = [];
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) fromItems.push(file);
  }
  return fromItems;
}

function WavingDots() {
  return (
    <span
      className="inline-flex h-[1em] w-[1.6em] items-center justify-center gap-[0.2em]"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="query-dot-wave inline-block size-[0.28em] rounded-full bg-current"
          style={{
            animation: "query-dot-wave 0.95s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}

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
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.size > 0);
    if (!next.length) return;
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePaste(e: ClipboardEvent<HTMLElement>) {
    if (queryDisabled || busy) return;
    const pasted = filesFromDataTransfer(e.clipboardData);
    if (!pasted.length) return;
    e.preventDefault();
    addFiles(pasted);
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (queryDisabled || busy) return;
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (queryDisabled || busy) return;
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);
    if (queryDisabled || busy) return;
    addFiles(filesFromDataTransfer(e.dataTransfer));
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

  const shell = (
    <div
      className={`w-full min-w-0 rounded-2xl border bg-card/90 p-3 shadow-sm backdrop-blur-[16px] transition-colors ${
        dragging
          ? "border-foreground/40 bg-muted/40"
          : "border-border"
      }`}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-full text-foreground hover:bg-muted"
          onClick={() => inputRef.current?.click()}
          aria-label="Attach file"
          disabled={!!busy || queryDisabled}
        >
          <Paperclip className="size-5" />
        </Button>
        {!queryOnly && (
          <IngestSlider
            disabled={!!busy}
            busy={busy === "ingest"}
            onConfirm={() => submit("ingest")}
          />
        )}
        <Button
          type="button"
          className="ml-auto h-11 shrink-0 gap-1.5 rounded-full px-4"
          disabled={!!busy || queryDisabled}
          onClick={() => submit("query")}
          aria-label={busy === "query" ? "Query in progress" : "Query"}
          aria-busy={busy === "query"}
        >
          <Search className="size-4" />
          {busy === "query" ? <WavingDots /> : "Query"}
        </Button>
      </div>
    </div>
  );

  // Aura only on the empty-state centered composer — not in chat mode.
  if (compact) return shell;
  return <ComposerAura>{shell}</ComposerAura>;
}
