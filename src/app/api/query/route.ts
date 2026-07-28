import { NextResponse } from "next/server";
import { parseAgentForm } from "@/lib/agent-request";
import { chatCompletion, type ChatMessage } from "@/lib/openrouter";
import { loadSkill } from "@/lib/skill-loader";
import { buildWikiContext } from "@/lib/wiki-context";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_HISTORY_TURNS = 5;

type HistoryTurn = {
  question: string;
  answer: string;
};

function parseHistory(raw: FormDataEntryValue | null): HistoryTurn[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const turns: HistoryTurn[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (
        typeof row.question === "string" &&
        row.question.trim() &&
        typeof row.answer === "string" &&
        row.answer.trim()
      ) {
        turns.push({
          question: row.question.trim(),
          answer: row.answer.trim(),
        });
      }
      if (turns.length >= MAX_HISTORY_TURNS) break;
    }
    return turns;
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const { text, repoUrl, attachmentNotes } = await parseAgentForm(formData);
    if (!text.trim()) {
      return NextResponse.json(
        { error: "Query requires a text question" },
        { status: 400 },
      );
    }

    const history = parseHistory(formData.get("history"));
    if (history.length >= MAX_HISTORY_TURNS) {
      return NextResponse.json(
        {
          error: `This chat already has ${MAX_HISTORY_TURNS} exchanges. Start a new chat.`,
        },
        { status: 400 },
      );
    }

    const skill = await loadSkill(repoUrl, "query");
    const { context, pageCount, ref } = await buildWikiContext(repoUrl, text);

    const system = [
      skill.content,
      "",
      "You are answering against a compiled wiki (read-only for this request).",
      "Do not invent facts missing from the provided wiki context.",
      "Answer in the same language as the user question.",
      "Lead with a direct answer, then cite wiki pages by path when useful.",
      "If evidence is missing, say what is missing.",
      "You may use earlier turns in this conversation for continuity, but ground facts in the latest wiki context.",
    ].join("\n");

    const messages: ChatMessage[] = [{ role: "system", content: system }];

    for (const turn of history) {
      messages.push({ role: "user", content: turn.question });
      messages.push({ role: "assistant", content: turn.answer });
    }

    const user = [
      `QUESTION:\n${text}`,
      "",
      attachmentNotes ? `ATTACHMENTS:\n${attachmentNotes}` : "",
      "",
      `WIKI CONTEXT (branch ${ref}, ${pageCount} pages):\n`,
      context,
    ]
      .filter(Boolean)
      .join("\n");

    messages.push({ role: "user", content: user });

    const { answer, model } = await chatCompletion(messages);

    return NextResponse.json({
      ok: true,
      action: "query",
      mode: "llm",
      answer,
      model,
      pageCount,
      ref,
      skillSource: skill.source,
      warning: skill.warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
