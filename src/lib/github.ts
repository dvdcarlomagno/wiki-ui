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

export async function getDefaultBranch(repoUrl: string) {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `GitHub repo error ${res.status}`);
  }
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `GitHub error ${res.status} for ${path}`);
  }
  if (data.encoding === "base64" && typeof data.content === "string") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );
  }
  return null;
}

type GhTreeItem = { path: string; type: string };

export async function listWikiMarkdownFiles(repoUrl: string, ref = "main") {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers: githubHeaders(), cache: "no-store" },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `GitHub tree error ${res.status}`);
  }
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `GitHub commits error ${res.status}`);
  }

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
