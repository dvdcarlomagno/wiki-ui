import { NextResponse } from "next/server";
import { getAgent, getRun, listRuns } from "@/lib/cursor-agents";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ agentId: string; runId: string }> },
) {
  try {
    const { agentId, runId } = await ctx.params;
    let run: unknown = null;
    let runError: string | undefined;

    try {
      run = await getRun(agentId, runId);
    } catch (err) {
      runError = err instanceof Error ? err.message : "Run fetch failed";
      try {
        const listed = await listRuns(agentId);
        run = listed;
      } catch {
        /* keep runError */
      }
    }

    const agent = await getAgent(agentId).catch(() => null);

    return NextResponse.json({
      ok: true,
      agentId,
      runId,
      agent,
      run,
      runError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
