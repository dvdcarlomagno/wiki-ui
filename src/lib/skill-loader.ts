import { readFile } from "fs/promises";
import path from "path";
import { getFileContent } from "@/lib/github";

export type SkillName = "ingest" | "query" | "lint";

export type LoadedSkill = {
  name: SkillName;
  content: string;
  source: "github" | "fallback";
  warning?: string;
};

async function readFallback(name: SkillName) {
  const file = path.join(
    process.cwd(),
    "skills-fallback",
    `${name}.md`,
  );
  return readFile(file, "utf8");
}

export async function loadSkill(
  repoUrl: string,
  name: SkillName,
): Promise<LoadedSkill> {
  try {
    const remote = await getFileContent(repoUrl, `skills/${name}.md`);
    if (remote?.trim()) {
      return { name, content: remote, source: "github" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub fetch failed";
    const fallback = await readFallback(name);
    return {
      name,
      content: fallback,
      source: "fallback",
      warning: `Using bundled skill fallback: ${message}`,
    };
  }

  const fallback = await readFallback(name);
  return {
    name,
    content: fallback,
    source: "fallback",
    warning: `skills/${name}.md missing in repo; using bundled fallback`,
  };
}

export function buildAgentPrompt(opts: {
  skill: LoadedSkill;
  action: "ingest" | "query";
  userText: string;
  attachmentNotes: string;
}) {
  return [
    opts.skill.content,
    "",
    "---",
    "REPO RULES: Follow AGENTS.md in the repo root. You own wiki/ maintenance.",
    `ACTION: ${opts.action}`,
    "",
    "USER:",
    opts.userText || "(no text)",
    "",
    "ATTACHMENTS:",
    opts.attachmentNotes || "(none)",
  ].join("\n");
}
