import { NextResponse } from "next/server";
import { defaultWikiRepoUrl } from "@/lib/agent-request";
import { getDefaultBranch, getFileContent } from "@/lib/github";

export const runtime = "nodejs";

function isAllowedPath(path: string) {
  return (
    !path.includes("..") &&
    !path.startsWith("/") &&
    (path === "index.md" || path.startsWith("wiki/")) &&
    path.endsWith(".md")
  );
}

async function loadPage(path: string) {
  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const repoUrl = defaultWikiRepoUrl();
  const ref = await getDefaultBranch(repoUrl);
  const content = await getFileContent(repoUrl, path, ref);
  if (content == null) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, path, ref, content });
}

export async function GET(req: Request) {
  try {
    const path = new URL(req.url).searchParams.get("path")?.trim();
    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }
    return await loadPage(path);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Page fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = String(body.path || "").trim();
    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }
    return await loadPage(path);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Page fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
