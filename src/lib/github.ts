export type RepoRef = { owner: string; repo: string };

export function parseGithubRepoUrl(url: string): RepoRef {
  const trimmed = url.trim().replace(/\.git$/, "");
  const match = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/i,
  );
  if (!match) {
    throw new Error("Invalid GitHub repo URL. Expected https://github.com/org/repo");
  }
  return { owner: match[1], repo: match[2] };
}

function githubToken() {
  // Prefer non-empty values: an empty shell GITHUB_TOKEN="" blocks .env.local in Next.
  const candidates = [
    process.env.WIKI_GITHUB_TOKEN,
    process.env.GITHUB_TOKEN,
  ];
  for (const value of candidates) {
    const token = value?.trim();
    if (token) return token;
  }
  return "";
}

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "wiki-ui",
  };
  const token = githubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readGithubJson(res: Response, context: string) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(
      `GitHub returned non-JSON for ${context} (${res.status}). ${preview || "Empty body."}`,
    );
  }

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `GitHub returned invalid JSON for ${context} (${res.status}).`,
    );
  }

  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `GitHub error ${res.status}`;

    if (
      res.status === 404 &&
      !githubToken() &&
      /not found/i.test(message)
    ) {
      throw new Error(
        `${message} — if this wiki repo is private, set WIKI_GITHUB_TOKEN or GITHUB_TOKEN in .env.local (a fine-grained or classic PAT with repo contents read).`,
      );
    }

    throw new Error(`${message} (${context})`);
  }

  return data;
}

export async function getDefaultBranch(repoUrl: string) {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  const data = (await readGithubJson(
    res,
    `repo ${owner}/${repo}`,
  )) as { default_branch?: string };
  return String(data.default_branch || "main");
}

export async function getFileContent(
  repoUrl: string,
  path: string,
  ref = "main",
) {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(api, { headers: githubHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  const data = (await readGithubJson(res, path)) as {
    encoding?: string;
    content?: string;
  };
  if (data.encoding === "base64" && typeof data.content === "string") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );
  }
  return null;
}

export type PutRepoFileResult = {
  path: string;
  sha: string;
  htmlUrl?: string;
};

/**
 * Create or update a file via the GitHub Contents API (base64).
 * Required for staging binary attachments before Cursor agent ingest —
 * the Cloud Agents API only accepts prompt text + raster images.
 */
export async function putRepoFile(opts: {
  repoUrl: string;
  path: string;
  content: Buffer | string;
  message: string;
  branch?: string;
}): Promise<PutRepoFileResult> {
  if (!githubToken()) {
    throw new Error(
      "WIKI_GITHUB_TOKEN or GITHUB_TOKEN with contents:write is required to upload attachments before ingest",
    );
  }

  const { owner, repo } = parseGithubRepoUrl(opts.repoUrl);
  const branch = opts.branch || (await getDefaultBranch(opts.repoUrl));
  const encodedPath = opts.path
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  let sha: string | undefined;
  const existing = await fetch(
    `${api}?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(), cache: "no-store" },
  );
  if (existing.ok) {
    const data = (await existing.json()) as { sha?: string };
    if (typeof data.sha === "string") sha = data.sha;
  }

  const content = Buffer.isBuffer(opts.content)
    ? opts.content.toString("base64")
    : Buffer.from(opts.content, "utf8").toString("base64");

  const res = await fetch(api, {
    method: "PUT",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: opts.message,
      content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  const data = (await readGithubJson(
    res,
    `put ${opts.path}`,
  )) as {
    content?: { sha?: string; html_url?: string; path?: string };
  };

  return {
    path: data.content?.path || opts.path,
    sha: String(data.content?.sha || ""),
    htmlUrl: data.content?.html_url,
  };
}

type GhTreeItem = { path: string; type: string };

export async function listWikiMarkdownFiles(repoUrl: string, ref?: string) {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const branch = ref || (await getDefaultBranch(repoUrl));
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: githubHeaders(), cache: "no-store" },
  );
  const data = (await readGithubJson(
    res,
    `tree ${owner}/${repo}@${branch}`,
  )) as { tree?: GhTreeItem[] };
  const tree = (data.tree || []) as GhTreeItem[];
  return tree
    .filter(
      (t) =>
        t.type === "blob" &&
        (t.path.startsWith("wiki/") || t.path === "index.md") &&
        t.path.endsWith(".md"),
    )
    .map((t) => t.path);
}

export type RepoCommit = {
  sha: string;
  message: string;
  date: string | null;
  url: string;
  author: string | null;
};

type GhCommit = {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string } | null;
    committer?: { name?: string; date?: string } | null;
  };
  author?: { login?: string } | null;
};

/** Newest commits first (GitHub default). */
export async function listRecentCommits(
  repoUrl: string,
  options?: { perPage?: number; sha?: string },
): Promise<RepoCommit[]> {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const perPage = Math.min(Math.max(options?.perPage ?? 40, 1), 100);
  const params = new URLSearchParams({ per_page: String(perPage) });
  if (options?.sha) params.set("sha", options.sha);

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?${params}`,
    { headers: githubHeaders(), cache: "no-store" },
  );
  const data = await readGithubJson(res, `commits ${owner}/${repo}`);

  const items = (Array.isArray(data) ? data : []) as GhCommit[];
  return items
    .filter((c): c is GhCommit & { sha: string } => Boolean(c?.sha))
    .map((c) => {
      const fullMessage = String(c.commit?.message || "").trim();
      const message = fullMessage.split("\n")[0]?.trim() || c.sha.slice(0, 7);
      return {
        sha: c.sha,
        message,
        date: c.commit?.author?.date || c.commit?.committer?.date || null,
        url: c.html_url || `https://github.com/${owner}/${repo}/commit/${c.sha}`,
        author:
          c.author?.login ||
          c.commit?.author?.name ||
          c.commit?.committer?.name ||
          null,
      };
    });
}
