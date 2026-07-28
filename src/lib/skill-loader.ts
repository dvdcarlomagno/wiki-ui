import { readFile } from "fs/promises";
import path from "path";
import { getFileContent } from "@/lib/github";

export type SkillName = "ingest" | "query" | "lint";

export type LoadedSkill = {
  name: SkillName;
  content: string;
  source: "local" | "github" | "fallback";
  warning?: string;
};

function skillsRepoUrl(wikiRepoUrl: string) {
  return process.env.SKILLS_REPO_URL?.trim() || wikiRepoUrl;
}

function skillsLocalDir() {
  return process.env.SKILLS_LOCAL_DIR?.trim() || "";
}

async function readFallback(name: SkillName) {
  const file = path.join(process.cwd(), "skills-fallback", `${name}.md`);
  return readFile(file, "utf8");
}

async function readLocalSkill(name: SkillName) {
  const dir = skillsLocalDir();
  if (!dir) return null;
  try {
    const content = await readFile(path.join(dir, `${name}.md`), "utf8");
    return content.trim() ? content : null;
  } catch {
    return null;
  }
}

export async function loadSkill(
  repoUrl: string,
  name: SkillName,
): Promise<LoadedSkill> {
  const local = await readLocalSkill(name);
  if (local) {
    return { name, content: local, source: "local" };
  }

  const remoteRepo = skillsRepoUrl(repoUrl);
  try {
    const remote = await getFileContent(remoteRepo, `skills/${name}.md`);
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
  const fromSkillsRepo = remoteRepo !== repoUrl;
  return {
    name,
    content: fallback,
    source: "fallback",
    warning: fromSkillsRepo
      ? `skills/${name}.md missing in ${remoteRepo}; using bundled fallback`
      : `skills/${name}.md missing in repo; using bundled fallback`,
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
