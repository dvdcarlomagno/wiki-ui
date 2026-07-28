# wiki-ui

Open-source, mobile-first Next.js UI for the [LLM Wiki](https://github.com/karpathy/llm-wiki) pattern.

Operators can **Query** a markdown knowledge base (via OpenRouter + wiki context) and **Ingest** new material (via Cursor Cloud Agents writing to a GitHub wiki repo). Includes a force-directed entity graph and ingest commit history.

## Stack

- Next.js 16 + React 19
- Tailwind CSS v4 + shadcn/ui (neutral, css variables)
- OpenRouter (Query)
- Cursor Cloud Agents API (Ingest)
- GitHub Contents / Trees / Commits APIs
- Shared-password gate (`APP_PASSWORD` + JWT cookie)

## Quick start

```bash
cp .env.example .env.local
# fill required env vars below
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_PASSWORD` | yes | Shared operator password |
| `AUTH_SECRET` | recommended | JWT signing secret (falls back to `APP_PASSWORD` in dev) |
| `DEFAULT_WIKI_REPO_URL` | yes | `https://github.com/OWNER/wiki-repo` |
| `SKILLS_REPO_URL` | no | GitHub repo for `skills/*.md` (defaults to wiki repo; used after local/`skills/`) |
| `SKILLS_LOCAL_DIR` | no | Absolute folder with `query.md` / `ingest.md` / `lint.md` (highest priority) |
| `OPENROUTER_API_KEY` | for Query | OpenRouter API key |
| `OPENROUTER_MODEL` | no | Default `deepseek/deepseek-v4-flash` |
| `CURSOR_API_KEY` | for Ingest | Cursor Cloud Agents API key |
| `CURSOR_MODEL` | no | Default `composer-2.5` |
| `GITHUB_TOKEN` / `WIKI_GITHUB_TOKEN` | recommended | GitHub token for private wiki repos / higher rate limits |
| `NEXT_PUBLIC_APP_URL` | no | Public app URL (default `http://localhost:3000`) |

`npm run dev` unsets common shell env keys (`GITHUB_TOKEN`, `WIKI_GITHUB_TOKEN`, `APP_PASSWORD`, etc.) so empty exported values cannot override `.env.local`. Prefer `WIKI_GITHUB_TOKEN` for private wiki repos.

## Wiki repository expectations

Point `DEFAULT_WIKI_REPO_URL` at a GitHub markdown wiki. The UI works best when the repo includes:

- Wiki pages under `wiki/` (or linked markdown the graph can parse)
- Optional agent skills at `skills/query.md`, `skills/ingest.md`, `skills/lint.md` in the wiki repo
- This app also ships repo skills in `skills/` (synced from ciclamino-ai/llm-wiki) and `skills-fallback/`

## Features

- Password-gated home with Query chat + slide-to-confirm Ingest
- Multi-conversation Query memory in `localStorage` (5 exchanges per chat)
- `/graph` — force-directed wiki graph + page pane
- `/history` — ingest history from GitHub commits

## Deploy

Deploy as a standard Next.js app (e.g. Vercel):

1. Set the environment variables above in your host
2. Connect the GitHub repo and deploy `main`
3. Set `NEXT_PUBLIC_APP_URL` to your production URL

## License

MIT — see [LICENSE](./LICENSE).
