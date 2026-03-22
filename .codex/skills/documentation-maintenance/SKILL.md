---
name: documentation-maintenance
description: Use when adding or changing Querylight TS features so documentation structure, article coverage, and tone stay consistent with the repo's docs architecture.
---

# Documentation Maintenance

Use this skill when a feature is added, removed, renamed, or materially changed, or when the docs structure itself needs maintenance.

## Goals

- Keep every feature documented.
- Prefer one focused feature article per feature instead of hiding new behavior inside broad overview pages.
- Keep the docs tree aligned with the demo TOC and the top-level `docs/index.md`.
- Preserve a consistent article shape and tone.

## Docs architecture

The docs live under topic subdirectories in `docs/`.

- `docs/overview`: introductions, orientation, comparisons, getting-started material
- `docs/schema`: schema design and modeling guidance
- `docs/analysis`: analyzers, tokenization, normalization
- `docs/lexical-querying`: lexical query types and boolean composition
- `docs/ranking`: scoring, reranking, feature scoring, tuning
- `docs/discovery`: aggregations, significant terms, exploratory retrieval
- `docs/indexing`: index structures, serialization, structured field types
- `docs/features`: cross-cutting capabilities that are not primarily lexical querying, ranking, or schema
- `docs/guides`: how-to articles and recipes
- `docs/demo`: demo internals and implementation writeups
- `docs/operations`: testing, performance, maintenance

Use these folders to mirror the TOC structure. Do not create new top-level doc buckets casually.

## Source of truth

Before editing anything, determine whether you are looking at:

- canonical documentation sources
- generated demo-site content
- generated payload artifacts

In this repository, the canonical docs source is `docs/`.

Treat these paths as generated outputs unless the user explicitly asks to work on the generation pipeline itself:

- `apps/demo/content/docs`
- `apps/demo/static/data`
- `apps/demo/public`
- `apps/demo/src/generated`

Do not make content edits directly in generated copies when the same material originates in `docs/`.

If a docs change must appear in the demo:

1. edit `docs/` first
2. update `docs/index.md` if navigation changed
3. regenerate the demo-site content and payloads from source
4. verify the generated output reflects the source change

If a stale generated file disagrees with `docs/`, treat `docs/` as authoritative and refresh or remove the stale artifact instead of patching around it.

## Coverage rules

- Every user-facing feature should have documentation.
- Prefer a separate article for each substantial feature, query type, ranking primitive, field type, or major capability.
- If a change affects an existing feature article, update that article in the same work session.
- If a change introduces a new feature without docs, add the new article before considering the task complete.
- If a change affects discoverability, navigation, or positioning, also update the relevant overview or guide pages.
- When adding a new page, update `docs/index.md` so the page appears in the section map.
- Keep front matter complete and consistent:
  - `id`
  - `section`
  - `title`
  - `summary`
  - `tags`
  - `apis`
  - `level`
  - `order`

## Feature article pattern

Feature articles should be narrowly scoped and structurally consistent. Default structure:

1. A short opening that says what the feature does and when to use it.
2. A minimal example that shows the basic API.
3. A section on behavior, semantics, or scoring model.
4. A section on tradeoffs, limitations, or when not to use it.
5. A short related-links section when there are obvious adjacent articles.

Recommended section headings:

- `# <Feature title>`
- `## Basic usage`
- `## How it works`
- `## When to use it`
- `## Limitations` or `## Tradeoffs`
- `## Related articles`

Not every article needs every heading, but the article should feel structurally familiar.

## Non-feature article pattern

Not all docs are feature references. Use different structures for:

- overview pages: positioning, concepts, capability maps, comparisons
- how-to pages: goal-oriented steps and design advice
- getting-started pages: a guided build-up from minimal to practical usage
- operations pages: testing, performance, release, maintenance guidance
- demo pages: architecture, build pipeline, indexing flow, UI behavior

Do not force all of these into the feature-reference template.

## Tone

Write in a direct technical style.

- Be concrete and specific.
- Prefer practical guidance over marketing language.
- Explain tradeoffs instead of overselling features.
- Assume a technically capable reader who wants signal, not hype.
- Use Elasticsearch/OpenSearch/Lucene comparisons when they clarify behavior, but do not imply full parity where it does not exist.
- Avoid vague claims like "powerful", "seamless", or "revolutionary".
- Keep examples small and runnable when possible.

## Update workflow

When a feature changes:

1. Identify the primary article that should own the change.
2. Decide whether the change is large enough to require a new dedicated article.
3. Update cross-links from adjacent articles if the new page changes the learning path.
4. Confirm you are editing the canonical source in `docs/`, not a generated demo copy.
5. Update `docs/index.md`.
6. If the docs demo relies on metadata or ordering, keep front matter aligned with the existing section taxonomy and regenerate the demo content from source.

## Naming and ordering

- Do not use numeric prefixes in filenames.
- Put ordering in front matter with numeric `order`.
- Prefer descriptive kebab-case filenames.
- Keep section names aligned with the demo TOC:
  - `Overview`
  - `Schema`
  - `Analysis`
  - `Lexical Querying`
  - `Ranking`
  - `Aggregations`
  - `Indexing`
  - `Other Features`
  - `Guides`
  - `Demo Internals`
  - `Operations`

## Done criteria

A docs-related feature change is not done until:

- the code change is documented in the correct article or a new article exists
- the canonical source in `docs/` was edited instead of a generated copy
- `docs/index.md` reflects the new structure
- front matter is complete and correctly ordered
- nearby links are updated when navigation changed
- generated demo docs/payloads are refreshed when they depend on the changed source
- the doc tone and structure match the rest of the docs set
