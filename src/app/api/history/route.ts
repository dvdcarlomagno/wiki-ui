import { NextResponse } from "next/server";
import { defaultWikiRepoUrl } from "@/lib/agent-request";
import { getDefaultBranch, listRecentCommits } from "@/lib/github";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repoUrl = defaultWikiRepoUrl();
    const ref = await getDefaultBranch(repoUrl);
    const commits = await listRecentCommits(repoUrl, { perPage: 40, sha: ref });
    return NextResponse.json({ ok: true, repoUrl, ref, commits });
  } catch (err) {
    const message = err instanceof Error ? err.message : "History failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
