export type QueryExchange = {
  id: string;
  question: string;
  answer: string;
  model?: string;
  warning?: string;
  createdAt: number;
};

const STORAGE_KEY = "wiki-ui-query-history";
const MAX_EXCHANGES = 100;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseHistory(raw: string | null): QueryExchange[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is QueryExchange => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.id === "string" &&
        typeof row.question === "string" &&
        typeof row.answer === "string" &&
        typeof row.createdAt === "number"
      );
    });
  } catch {
    return [];
  }
}

export function loadQueryHistory(): QueryExchange[] {
  if (!canUseStorage()) return [];
  return parseHistory(window.localStorage.getItem(STORAGE_KEY));
}

export function saveQueryHistory(exchanges: QueryExchange[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(exchanges.slice(-MAX_EXCHANGES)),
  );
}

export function appendQueryExchange(
  input: Omit<QueryExchange, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): QueryExchange {
  const exchange: QueryExchange = {
    id: input.id ?? crypto.randomUUID(),
    question: input.question,
    answer: input.answer,
    model: input.model,
    warning: input.warning,
    createdAt: input.createdAt ?? Date.now(),
  };
  const next = [...loadQueryHistory(), exchange].slice(-MAX_EXCHANGES);
  saveQueryHistory(next);
  return exchange;
}

export function clearQueryHistory() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
