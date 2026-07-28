export const MAX_EXCHANGES_PER_CONVERSATION = 5;

export type ConversationExchange = {
  id: string;
  question: string;
  answer: string;
  model?: string;
  warning?: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  exchanges: ConversationExchange[];
};

type Store = {
  conversations: Conversation[];
  activeId: string | null;
};

const STORAGE_KEY = "wiki-ui-conversations-v1";
const MAX_CONVERSATIONS = 50;
const TITLE_MAX = 56;

function canUseStorage() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function emptyStore(): Store {
  return { conversations: [], activeId: null };
}

function parseStore(raw: string | null): Store {
  if (!raw) return emptyStore();
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return emptyStore();
    const obj = data as Record<string, unknown>;
    const list = Array.isArray(obj.conversations) ? obj.conversations : [];
    const conversations = list.filter((item): item is Conversation => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.id === "string" &&
        typeof row.title === "string" &&
        typeof row.createdAt === "number" &&
        typeof row.updatedAt === "number" &&
        Array.isArray(row.exchanges)
      );
    });
    const activeId =
      typeof obj.activeId === "string" || obj.activeId === null
        ? (obj.activeId as string | null)
        : null;
    return { conversations, activeId };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadConversationStore(): Store {
  if (!canUseStorage()) return emptyStore();
  return parseStore(window.localStorage.getItem(STORAGE_KEY));
}

export function titleFromQuestion(question: string) {
  const clean = question.replace(/\s+/g, " ").trim();
  if (clean.length <= TITLE_MAX) return clean || "New chat";
  return `${clean.slice(0, TITLE_MAX - 1)}…`;
}

export function listConversationsNewestFirst(): Conversation[] {
  return [...loadConversationStore().conversations].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function getActiveConversationId(): string | null {
  return loadConversationStore().activeId;
}

export function getConversation(id: string | null): Conversation | null {
  if (!id) return null;
  return loadConversationStore().conversations.find((c) => c.id === id) || null;
}

export function setActiveConversationId(id: string | null) {
  const store = loadConversationStore();
  store.activeId = id;
  writeStore(store);
}

/** Start a blank active chat (no persisted row until first query). */
export function startNewConversation() {
  const store = loadConversationStore();
  store.activeId = null;
  writeStore(store);
}

export function appendExchangeToActive(input: {
  question: string;
  answer: string;
  model?: string;
  warning?: string;
}): { conversation: Conversation; exchange: ConversationExchange } {
  const store = loadConversationStore();
  const now = Date.now();
  const exchange: ConversationExchange = {
    id: crypto.randomUUID(),
    question: input.question,
    answer: input.answer,
    model: input.model,
    warning: input.warning,
    createdAt: now,
  };

  let conversation =
    (store.activeId &&
      store.conversations.find((c) => c.id === store.activeId)) ||
    null;

  if (!conversation) {
    conversation = {
      id: crypto.randomUUID(),
      title: titleFromQuestion(input.question),
      createdAt: now,
      updatedAt: now,
      exchanges: [exchange],
    };
    store.conversations = [conversation, ...store.conversations].slice(
      0,
      MAX_CONVERSATIONS,
    );
    store.activeId = conversation.id;
  } else {
    if (conversation.exchanges.length >= MAX_EXCHANGES_PER_CONVERSATION) {
      throw new Error(
        `This chat already has ${MAX_EXCHANGES_PER_CONVERSATION} exchanges. Start a new chat.`,
      );
    }
    conversation = {
      ...conversation,
      updatedAt: now,
      exchanges: [...conversation.exchanges, exchange],
    };
    store.conversations = store.conversations.map((c) =>
      c.id === conversation!.id ? conversation! : c,
    );
  }

  writeStore(store);
  return { conversation, exchange };
}

export type PriorTurn = {
  question: string;
  answer: string;
};

export function priorTurnsForApi(
  conversation: Conversation | null,
): PriorTurn[] {
  if (!conversation) return [];
  return conversation.exchanges.map((e) => ({
    question: e.question,
    answer: e.answer,
  }));
}
