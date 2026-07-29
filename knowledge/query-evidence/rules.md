# Rules

1. **Fetch links in query** — Extract and fetch `http(s)` URLs from the question and text attachments; include successful bodies under `LINKED PAGE CONTENT`.
2. **Evaluate attachments in query** — Inline text-like files; attach images multimodally; extract PDF text with `unpdf` or fail closed (never send metadata-only stubs).
3. **Ingest attachments via stage+prompt** — Cursor Agents API has no binary upload; commit originals to `raw/` / `raw/assets/` with GitHub Contents API, put extracted text + staged paths in the agent prompt, then `createAgent`.
4. **Bound wiki context** — Prefer ≤45k chars / ≤12 pages for OpenRouter latency; do not silently grow back to 90k without measuring end-to-end time.
5. **Never claim no access when content was fetched** — System instructions must allow using linked/attachment evidence and forbid false “no access” when that section is present.
