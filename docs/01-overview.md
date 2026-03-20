---
id: overview
section: Overview
title: What Querylight TS Covers
summary: A compact browser and Node.js search toolkit for structured, explainable retrieval.
tags: [overview, bm25, tfidf, document-index, browser]
apis: [DocumentIndex, TextFieldIndex, MatchAll, RankingAlgorithm]
level: foundation
order: "01"
---

# What Querylight TS Covers

Querylight TS is a pure TypeScript search toolkit for browsers and Node.js. It combines text retrieval, structured boolean queries, multi-field search, phrase search, prefix expansion, aggregations, vector search, geo search, and portable index state under one API.

If you are new to search tooling, the easiest mental model is:

- A `DocumentIndex` stores your documents.
- Each `TextFieldIndex` indexes one field such as `title`, `body`, or `tags`.
- A query object describes what you want to match.
- `searchRequest(...)` returns scored hits as `[id, score]` tuples.

## Why it is broader than a fuzzy-only library

- It indexes structured fields instead of only flat strings.
- It supports both TF-IDF and BM25 ranking.
- It exposes `BoolQuery` with `should`, `must`, `filter`, `mustNot`, and `minimumShouldMatch`.
- It includes dedicated `PrefixQuery`, `TermsQuery`, `ExistsQuery`, and `MultiMatchQuery` building blocks.
- It supports terms aggregations and significant terms for discovery.
- It includes `VectorFieldIndex` and `GeoFieldIndex` for non-lexical retrieval.

## Minimal setup

```ts
import { DocumentIndex, MatchAll, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex(),
  body: new TextFieldIndex()
});

index.index({
  id: "intro",
  fields: {
    title: ["Querylight TS"],
    body: ["Portable search for browser and Node.js"]
  }
});

const hits = index.searchRequest({ query: new MatchAll(), limit: 10 });
```

Expected result:

```ts
[
  ["intro", 1]
]
```

That `1` is the score for the matching document. Scores are mainly useful for ordering results. The important part is that the hit tells you which document matched.

## What the result ids are for

Search returns ids first, not your full source objects. That keeps the index compact and lets you decide how to store and render your actual documents.

Typical pattern:

```ts
const sourceDocuments = new Map([
  ["intro", { title: "Querylight TS", url: "/docs/intro" }]
]);

const hits = index.searchRequest({ query: new MatchAll(), limit: 10 });
const results = hits.map(([id, score]) => ({
  ...sourceDocuments.get(id),
  score
}));
```

Expected result:

```ts
[
  {
    title: "Querylight TS",
    url: "/docs/intro",
    score: 1
  }
]
```

## Common next steps

- Add more fields such as `summary`, `tags`, or `api`.
- Replace `MatchAll` with `MatchQuery`, `MatchPhrase`, or `BoolQuery`.
- Use aggregations to build facets from the current result set.
- Serialize the index at build time and load it in the browser.

## Learn more

- [Information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Information_retrieval)
- [Okapi BM25 on Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
