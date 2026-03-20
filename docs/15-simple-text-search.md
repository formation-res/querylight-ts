---
id: simple-text-search
section: Operations
title: SimpleTextSearch for Plain JSON Documents
summary: A beginner path that builds a usable index from plain objects and runs a good-enough default search.
tags: [simple, search, fuzzy, prefix, beginner]
apis: [createSimpleTextSearchIndex, simpleTextSearch, DocumentIndex]
level: foundation
order: "15"
---

# SimpleTextSearch for Plain JSON Documents

If you want a practical default without assembling your own `BoolQuery`, Querylight TS can build a search bundle from plain JSON documents and run a broader lexical + fuzzy search for you.

## Beginner setup

```ts
import { createSimpleTextSearchIndex, simpleTextSearch } from "@tryformation/querylight-ts";

const search = createSimpleTextSearchIndex({
  documents: [
    {
      id: "range-filters",
      title: "RangeQuery Over Lexical Fields",
      description: "Use lexical ranges over sortable string values.",
      body: "RangeQuery compares terms lexically."
    }
  ],
  primaryFields: ["title"],
  secondaryFields: ["description", "body"]
});

const hits = simpleTextSearch(search, { query: "range fi", limit: 5 });
```

## What it does

- Indexes the declared primary and secondary fields.
- Builds default prefix support for incomplete queries.
- Builds a fuzzy side index for typo-tolerant matching.
- Fuses the lexical and fuzzy rankings with reciprocal rank fusion.

The returned bundle also exposes the underlying `DocumentIndex` so you can graduate to custom queries later without re-indexing your data.

For a fuller walkthrough, including the equivalent manual setup and a build-time browser architecture, see [Getting Started with Browser Search](./16-getting-started.md).
