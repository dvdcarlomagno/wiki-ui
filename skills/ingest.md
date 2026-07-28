# Skill: Ingest

You are ingesting one source into the Ciclamino LLM Wiki. Follow `AGENTS.md`.

## Input

The user message contains:
- Source text and/or URL
- Optional description
- Optional images/files (store non-text under `raw/assets/`, text/url under `raw/`)

## Steps

1. **Understand** — Extract claims, entities, concepts, dates, and open questions.
2. **File raw** — If the source is not already in `raw/`, write it as an immutable file (e.g. `raw/YYYY-MM-DD-slug.md`). Download/save attachments to `raw/assets/` when provided as files.
3. **Summary page** — Create or update a flat wiki summary page (e.g. `wiki/source-<slug>.md`) with key takeaways and links to entities/concepts. Do not create new subfolders under `raw/` or `wiki/` unless the human asks.
4. **Integrate** — Update every affected entity/concept page in `wiki/` (flat kebab-case files). Strengthen or challenge existing synthesis. Flag contradictions.
5. **Index** — Add/update entries in `index.md` (category + one-line summary).
6. **Log** — Append an ingest entry to `log.md` with the standard prefix.
7. **Report** — End with a short human summary: what was learned, pages touched, contradictions found.

## Quality bar

- Cross-link with `[[Page Name]]`.
- Prefer revising hub pages over sprawling one-off notes.
- If the source is thin, say so; do not pad.
