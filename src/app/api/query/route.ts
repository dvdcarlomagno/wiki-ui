import { NextResponse } from "next/server";
import {
  attachmentUrlSourceText,
  formatQueryAttachments,
  parseAgentForm,
} from "@/lib/agent-request";
import {
  fetchLinkedPages,
  formatLinkedPages,
} from "@/lib/fetch-linked-pages";
import {
  buildUserContent,
  chatCompletion,
  type ChatMessage,
} from "@/lib/openrouter";
import { loadSkill } from "@/lib/skill-loader";
import { buildWikiContext } from "@/lib/wiki-context";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const form = await parseAgentForm(formData);
    const { text, repoUrl, images } = form;
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
    const attachmentBlock = formatQueryAttachments(form);
    const [{ context, pageCount, ref }, linkedPages] = await Promise.all([
      buildWikiContext(repoUrl, text),
      fetchLinkedPages(text, attachmentUrlSourceText(form)),
    ]);
    const linkedContent = formatLinkedPages(linkedPages);

    const system = [
      skill.content,
      "",
      "You are answering against a compiled wiki (read-only for this request).",
      "Ground wiki facts in the provided wiki context; do not invent wiki pages.",
      "Evaluate ALL provided evidence: LINKED PAGE CONTENT, ATTACHMENTS (text and images), and WIKI CONTEXT.",
      "If LINKED PAGE CONTENT is provided, you MAY read and use it for the user question.",
      "Do not claim you lack access to a link when its content is present under LINKED PAGE CONTENT.",
      "If a linked page fetch failed or an attachment could not be extracted, say that explicitly.",
      "Answer in the same language as the user question.",
      "Lead with a direct answer, then cite wiki pages by path when useful.",
      "If evidence is missing, say what is missing.",
      "You may use earlier turns in this conversation for continuity, but ground facts in the latest wiki context, linked pages, and attachments.",
    ].join("\n");

    const messages: ChatMessage[] = [{ role: "system", content: system }];

    for (const turn of history) {
      messages.push({ role: "user", content: turn.question });
      messages.push({ role: "assistant", content: turn.answer });
    }

    const userText = [
      `QUESTION:\n${text}`,
      "",
      attachmentBlock ? `ATTACHMENTS:\n\n${attachmentBlock}` : "",
      "",
      linkedContent
        ? `LINKED PAGE CONTENT (${linkedPages.filter((p) => p.ok).length}/${linkedPages.length} fetched):\n\n${linkedContent}`
        : "",
      "",
      `WIKI CONTEXT (branch ${ref}, ${pageCount} pages):\n`,
      context,
    ]
      .filter(Boolean)
      .join("\n");

    messages.push({
      role: "user",
      content: buildUserContent(userText, images),
    });

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
      linkedPages: linkedPages.map((p) => ({
        url: p.url,
        ok: p.ok,
        title: p.title,
        error: p.error,
      })),
      attachments: {
        textCount: form.textAttachments.length,
        imageCount: images.length,
        binaryCount: form.binaryAttachments.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
