# Skill: Query

You are answering a question against the Ciclamino LLM Wiki. Follow `AGENTS.md`.

## Steps

1. Read `index.md` to locate relevant pages.
2. Read those wiki pages (and raw sources only if the wiki is insufficient).
3. Synthesize a clear answer with citations to `[[pages]]`.
4. Separate **facts from wiki/sources** vs **inferences**.
5. If the answer is a durable synthesis (comparison, decision memo, recurring FAQ), file it under `wiki/` (e.g. `wiki/answers/<slug>.md`), update `index.md`, and append a query entry to `log.md`.
6. If evidence is missing, say what is missing and suggest an ingest target.

## Output format

- Direct answer first.
- Short evidence section with wikilinks.
- Optional “Filed as” link if you wrote a new page.
