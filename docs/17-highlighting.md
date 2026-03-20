---
id: highlighting
section: Operations
title: Highlighting with Querylight TS
summary: Generate exact and phrase highlight fragments after retrieval using stored source offsets.
tags: [highlighting, offsets, snippets, search]
apis: [DocumentIndex, MatchQuery, MatchPhrase]
level: foundation
order: "17"
---

# Highlighting with Querylight TS

Highlighting in Querylight TS is a post-retrieval step.

That means you:

1. run a normal query and get back hits
2. choose which fields to highlight for those hits
3. ask the `DocumentIndex` to generate fragments from the original stored field text

This keeps ranking and highlighting separate, similar to how Elasticsearch/OpenSearch treat highlighting.

## Basic usage

```ts
import { DocumentIndex, MatchQuery, RankingAlgorithm, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25),
  body: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25)
});

index.index({
  id: "range-filters",
  fields: {
    title: ["RangeQuery Over Lexical Fields"],
    body: ["Range filters work well for sortable values and filtering interfaces."]
  }
});

const query = new MatchQuery("body", "range filters");
const hits = index.searchRequest({ query, limit: 5 });

const highlight = index.highlight(hits[0]![0], query, {
  fields: ["title", "body"],
  fragmentSize: 140,
  numberOfFragments: 1
});
```

## What the highlighter returns

The result is grouped by field and each field contains one or more fragments.

Each fragment includes:

- fragment text from the original stored value
- highlighted parts ready to render as `<mark>` spans
- exact source-relative offsets for the highlighted spans

This is useful for:

- result-title highlighting
- short “why it matched” excerpts
- exact and phrase evidence on prose fields

## Current support

The current implementation is intentionally conservative:

- exact term highlighting
- phrase highlighting
- source offsets from stored field text

That makes it reliable for fields such as `title`, `summary`-style fields, and `body`.

## Current limitations

This is not yet a full clone of all Elasticsearch/OpenSearch highlighter modes.

In particular:

- prefix and fuzzy matches are not yet rendered as first-class highlight evidence
- analyzers that depend on token filters such as ngrams are not offset-aware for highlighting
- fragment selection is simple and works best on prose
- code-heavy fields are usually poor candidates for result-card snippets

For best results in the UI, highlight prose fields and keep code/example fields out of default result snippets.
