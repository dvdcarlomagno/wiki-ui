# Rules

1. **Fetch links in query** — Extract and fetch `http(s)` URLs from the question and text attachments; include successful bodies under `LINKED PAGE CONTENT`.
2. **Evaluate attachments in query** — Inline text-like files; attach images multimodally; explicitly mark PDFs/binaries as not extracted.
3. **Bound wiki context** — Prefer ≤45k chars / ≤12 pages for OpenRouter latency; do not silently grow back to 90k without measuring end-to-end time.
4. **Never claim no access when content was fetched** — System instructions must allow using linked/attachment evidence and forbid false “no access” when that section is present.
