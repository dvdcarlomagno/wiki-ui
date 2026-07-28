import { NextResponse } from "next/server";
import { defaultWikiRepoUrl } from "@/lib/agent-request";
import { buildWikiGraph } from "@/lib/wiki-graph";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repoUrl = defaultWikiRepoUrl();
    const graph = await buildWikiGraph(repoUrl);
    return NextResponse.json({ ok: true, repoUrl, ...graph });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Graph failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
