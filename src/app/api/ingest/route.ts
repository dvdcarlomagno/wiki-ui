import { NextResponse } from "next/server";
import { createAgent } from "@/lib/cursor-agents";
import { parseAgentForm } from "@/lib/agent-request";
import { getDefaultBranch } from "@/lib/github";
import { buildAgentPrompt, loadSkill } from "@/lib/skill-loader";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const { text, repoUrl, images, attachmentNotes } =
      await parseAgentForm(formData);
    const skill = await loadSkill(repoUrl, "ingest");
    const prompt = buildAgentPrompt({
      skill,
      action: "ingest",
      userText: text,
      attachmentNotes,
    });
    const startingRef = await getDefaultBranch(repoUrl);

    const result = await createAgent({
      text: prompt,
      images,
      repoUrl,
      startingRef,
      name: `llm-wiki ingest ${text.slice(0, 40) || "attachment"}`,
    });

    return NextResponse.json({
      ok: true,
      action: "ingest",
      agentId: result.agent.id,
      runId: result.run.id,
      url: result.agent.url,
      skillSource: skill.source,
      warning: skill.warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    const status =
      typeof err === "object" &&
      err &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
