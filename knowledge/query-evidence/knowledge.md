# Query evidence (links + attachments)

## Root cause (2026-07-28)

Two stacked failure modes on questions that include external URLs (e.g. Substack):

1. **Missing evidence** — `/api/query` only loaded wiki markdown + optional attachment *notes*. It never fetched `http(s)` links from the question, so the model replied that it could not access the article.
2. **Client `Load failed`** — wiki context was capped at ~90k chars; OpenRouter often took 60–80s. Safari/WebKit surfaces a dropped long fetch as `Load failed` even when the server would eventually return 200.

Verified: post-fix run fetched the Substack page (`linkedOk: 1`, ~7.9k chars) and the answer no longer claimed no access (`mentionsNoAccess: false`). Client received HTTP 200.

## Current pipeline

Query prompt evidence order:

1. Question text
2. Attachments — text files inlined; images as multimodal parts; PDFs extracted via `unpdf` (fail closed if no text)
3. Linked page content — URLs extracted from question **and** text attachments, fetched server-side
4. Ranked wiki context (leaner cap: 45k chars / 12 pages)

## PDF / attachment ingest (2026-07-29)

Root cause: Cursor Cloud Agents API (`POST /v1/agents`) only accepts `prompt.text` + up to 5 raster `prompt.images` (png/jpeg/gif/webp). There is **no** binary/file attachment field. PDFs were classified as binary and the prompt only got filename/size metadata; the agent still ran and synthesized from the title.

Fix:
1. Extract PDF text with `unpdf` into the prompt (fail closed if no selectable text).
2. Stage **original** attachment bytes into the wiki repo via GitHub Contents API (`raw/` or `raw/assets/`) **before** `createAgent`, then tell the agent the staged path.
3. Images still go to `prompt.images` and are also staged.
4. Query mode: extract text/PDF or fail closed (no GitHub staging for LLM answers).

Requires `WIKI_GITHUB_TOKEN` / `GITHUB_TOKEN` with `contents:write` for ingest staging.

## Patterns

- Treat URLs in the question as first-class evidence for LLM query mode (not only for ingest agents).
- Keep wiki context bounded; latency is dominated by OpenRouter on large prompts.
- Ingest still sends images to Cursor agents; query must send images to OpenRouter itself or they are invisible to the model.
- Never launch ingest with metadata-only attachments; extract text and/or stage bytes, else reject.
- Cursor API cannot receive arbitrary binaries — stage into the target repo instead.
