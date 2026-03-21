---
id: overview
section: Overview
title: What Querylight TS Covers
summary: A compact browser and Node.js search toolkit for structured, explainable retrieval.
tags: [overview, bm25, tfidf, document-index, browser]
apis: [DocumentIndex, TextFieldIndex, MatchAll, RankingAlgorithm]
level: foundation
order: 20
---

# What Querylight TS Covers

Querylight TS is a pure TypeScript search toolkit for browsers and Node.js. It combines text retrieval, structured boolean queries, multi-field search, phrase search, prefix expansion, aggregations, vector search, geo search, and portable index state under one API.

In practical terms, that means you can use one local library to power very different kinds of search experiences:

- a docs search box with highlighting and BM25 ranking
- faceted or filtered discovery over structured metadata
- "Ask the Docs" style semantic search over chunked content
- related-article or recommendation features using vector similarity
- geo-aware retrieval for map or region-based content

That breadth is the main reason to use Querylight TS instead of a narrower fuzzy-only library.

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

## Common problems it can solve

If you are evaluating fit, these are the most common "jobs" Querylight TS can cover:

- Site search and docs search:
  `TextFieldIndex`, `MatchQuery`, `MultiMatchQuery`, BM25, and highlighting.
- Semantic search for help centers or docs:
  `VectorFieldIndex`, chunking, and `VectorRescoreQuery`.
- Related content and recommendations:
  vector similarity over articles, pages, or chunks.
- Faceted navigation:
  `BoolQuery`, terms aggregations, and metadata fields such as tags, section, or product.
- Typo-tolerant discovery:
  prefix queries, ngram analyzers, and `bigramVector`.
- Geo-filtered search:
  `GeoFieldIndex`, `GeoPointQuery`, and `GeoPolygonQuery`.

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
- Add vectors for semantic search or related-content features.
- Serialize the index at build time and load it in the browser.

## More guides

- [Choosing a Schema for Search](./../schema/choosing-a-schema-for-search.md)
- [Analyzer and Tokenization Deep Dive](./../analysis/analyzer-and-tokenization-deep-dive.md)
- [How To Build Autocomplete](./../guides/how-to-build-autocomplete.md)
- [How To Build Faceted Navigation](./../guides/how-to-build-faceted-navigation.md)
- [Relevance Tuning with BM25, TF-IDF, and RRF](./../ranking/relevance-tuning.md)
- [Document Chunking Strategies](./../features/document-chunking-strategies.md)
- [Serialization, Hydration, and Shipping Indexes](./../indexing/serialization-hydration-and-shipping-indexes.md)
- [Performance and Memory Tuning](./../operations/performance-and-memory-tuning.md)
- [Testing Search Behavior](./../operations/testing-search-behavior.md)
- [Real-World Recipes](./../guides/real-world-recipes.md)
- [Other Work Related to Querylight TS](./other-work-related-to-querylight-ts.md)
- [Comparing Querylight TS to Other Browser Search Libraries](./browser-search-library-comparison.md)

## Learn more

- [Information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Information_retrieval)
- [Okapi BM25 on Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
