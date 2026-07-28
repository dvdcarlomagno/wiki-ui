# Skill: Lint

Health-check the wiki. Follow `AGENTS.md`.

## Checklist

1. **Contradictions** — Same entity/concept claiming incompatible facts.
2. **Stale claims** — Superseded by newer sources; update or mark historical.
3. **Orphans** — Pages with no inbound links from `index.md` or other pages.
4. **Missing pages** — Important concepts mentioned but lacking a page.
5. **Weak cross-refs** — Mentions that should be `[[wikilinks]]`.
6. **Index drift** — Pages exist but missing from `index.md` (or vice versa).
7. **Log hygiene** — Recent ops present; no rewritten history.

## Output

- Findings list (severity: high/med/low).
- Proposed edits (you may apply safe fixes now).
- Suggested questions / sources to ingest next.

Append a lint entry to `log.md` when you complete a pass.
