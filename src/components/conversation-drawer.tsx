"use client";

import { MessageSquare, X } from "lucide-react";
import type { Conversation } from "@/lib/conversations";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

export function ConversationDrawerButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label="Past chats"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
    >
      <MessageSquare className="size-5" />
    </Button>
  );
}

export function ConversationDrawer({
  open,
  onOpenChange,
  conversations,
  activeId,
  onSelect,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/35"
        aria-label="Close chats"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-border bg-card/95 shadow-lg backdrop-blur-[18px]"
        role="dialog"
        aria-label="Past chats"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Chat
            </p>
            <h2 className="text-xl font-semibold leading-none">Conversations</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-6 text-sm text-muted-foreground">
              No chats yet. Run a Query to get started.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(c.id);
                        onOpenChange(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-primary/15" : "hover:bg-muted"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                        {c.title}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.exchanges.length}/5 ·{" "}
                        {new Date(c.updatedAt).toLocaleString("en-US", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
