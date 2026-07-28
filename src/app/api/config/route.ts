import { NextResponse } from "next/server";
import { defaultWikiRepoUrl } from "@/lib/agent-request";

export async function GET() {
  return NextResponse.json({
    defaultWikiRepoUrl: defaultWikiRepoUrl(),
    hasCursorKey: Boolean(process.env.CURSOR_API_KEY),
    hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
    openRouterModel:
      process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash",
  });
}
