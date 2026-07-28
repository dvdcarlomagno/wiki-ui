const API_BASE = "https://api.cursor.com";

export type CursorImage = {
  data: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
};

export type CreateAgentInput = {
  text: string;
  images?: CursorImage[];
  repoUrl: string;
  startingRef?: string;
  name?: string;
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
};

function apiKey() {
  const key = process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error("CURSOR_API_KEY is not configured");
  }
  return key;
}

function authHeader() {
  const key = apiKey();
  const basic = Buffer.from(`${key}:`).toString("base64");
  return { Authorization: `Basic ${basic}` };
}

function modelSelection() {
  const id = process.env.CURSOR_MODEL || "composer-2.5";
  // Cloud wiki ingest/query: prefer standard (non-fast) unless overridden.
  const fast =
    process.env.CURSOR_MODEL_FAST === "true"
      ? "true"
      : process.env.CURSOR_MODEL_FAST === "false"
        ? "false"
        : "false";
  return {
    id,
    params: [{ id: "fast", value: fast }],
  };
}

export async function createAgent(input: CreateAgentInput) {
  const body = {
    prompt: {
      text: input.text,
      ...(input.images?.length ? { images: input.images } : {}),
    },
    model: modelSelection(),
    repos: [
      {
        url: input.repoUrl,
        startingRef: input.startingRef || "main",
      },
    ],
    workOnCurrentBranch: input.workOnCurrentBranch ?? true,
    autoCreatePR: input.autoCreatePR ?? false,
    mode: "agent",
    ...(input.name ? { name: input.name.slice(0, 100) } : {}),
  };

  const res = await fetch(`${API_BASE}/v1/agents`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message =
      data?.error?.message ||
      data?.message ||
      `Cursor API error ${res.status}`;
    if (/verify existence of branch/i.test(message)) {
      message = `${message} — Cursor cannot see this private repo/branch. In Cursor Dashboard → Integrations → GitHub, grant the GitHub App access to your wiki repository (org approval may be required), then retry.`;
    }
    const err = new Error(message) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as {
    agent: { id: string; url?: string; status?: string; name?: string };
    run: { id: string; status?: string };
  };
}

export async function getAgent(agentId: string) {
  const res = await fetch(`${API_BASE}/v1/agents/${agentId}`, {
    headers: authHeader(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Failed to get agent ${res.status}`);
  }
  return data;
}

export async function getRun(agentId: string, runId: string) {
  const res = await fetch(`${API_BASE}/v1/agents/${agentId}/runs/${runId}`, {
    headers: authHeader(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Failed to get run ${res.status}`);
  }
  return data;
}

export async function listRuns(agentId: string) {
  const res = await fetch(`${API_BASE}/v1/agents/${agentId}/runs`, {
    headers: authHeader(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Failed to list runs ${res.status}`);
  }
  return data;
}
