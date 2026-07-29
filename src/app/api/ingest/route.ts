import { NextResponse } from "next/server";
import {
  parseAgentForm,
  stagingPathForUpload,
} from "@/lib/agent-request";
import { createAgent } from "@/lib/cursor-agents";
import { getDefaultBranch, putRepoFile } from "@/lib/github";
import { buildAgentPrompt, loadSkill } from "@/lib/skill-loader";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const form = await parseAgentForm(formData, { purpose: "ingest" });
    const { text, repoUrl, images, attachmentNotes, pendingUploads } = form;

    const startingRef = await getDefaultBranch(repoUrl);

    // Cursor Cloud Agents API only accepts prompt.text + prompt.images.
    // Stage every original attachment into the wiki repo so the agent can read it.
    const stagedLines: string[] = [];
    const stagedPaths: string[] = [];
    for (const upload of pendingUploads) {
      const path = stagingPathForUpload(upload);
      await putRepoFile({
        repoUrl,
        path,
        content: upload.buf,
        message: `chore(ingest): stage attachment ${upload.name}`,
        branch: startingRef,
      });
      stagedPaths.push(path);
      stagedLines.push(
        `- staged: \`${path}\` (${upload.name}, ${upload.mime}, ${upload.buf.byteLength} bytes) — already in the repo; use this file.`,
      );
    }

    const notes = [attachmentNotes, stagedLines.join("\n")]
      .filter((block) => block.trim())
      .join("\n\n");

    // Fail closed: attachments present but nothing readable/staged.
    const hasFiles = pendingUploads.length > 0 || images.length > 0;
    const hasUsablePayload =
      text.trim() ||
      form.textAttachments.length > 0 ||
      images.length > 0 ||
      stagedLines.length > 0;
    if (hasFiles && !hasUsablePayload) {
      throw new Error(
        "Attachments could not be prepared for ingest — nothing was ingested.",
      );
    }

    const skill = await loadSkill(repoUrl, "ingest");
    const prompt = buildAgentPrompt({
      skill,
      action: "ingest",
      userText: text,
      attachmentNotes: notes,
    });

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
      staged: stagedPaths,
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
