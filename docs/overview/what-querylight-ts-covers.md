---
id: overview
section: Overview
title: What Querylight TS Covers
summary: A compact browser and Node.js search toolkit for structured, explainable retrieval with an OpenSearch-style JSON DSL.
tags: [overview, bm25, tfidf, document-index, browser]
apis: [searchJsonDsl, parseJsonDslQuery, DocumentIndex, TextFieldIndex, RankingAlgorithm]
level: foundation
order: 20
---

# What Querylight TS Covers

Querylight TS is a pure TypeScript search toolkit for browsers and Node.js. It is positioned as the most feature-rich local search library for static sites and browser apps. It combines text retrieval, structured boolean queries, multi-field search, phrase search, prefix expansion, aggregations, dense vector search, sparse vector search, geo search, and portable index state under one API. For a direct comparison with narrower browser-first libraries, see [Comparing Querylight TS to Other Browser Search Libraries](./browser-search-library-comparison.md).

In practical terms, that means you can use one local library to power very different kinds of search experiences:

- a docs search box with highlighting and BM25 ranking
- a dense vector search mode for semantic retrieval and related-content features
- a sparse vector search mode for learned token-weight retrieval
- faceted or filtered discovery over structured metadata
- "Ask the Docs" style semantic search over chunked content
- related-article or recommendation features using vector similarity
- geo-aware retrieval for map or region-based content

That breadth matters when you want one local index model for search, filters, facets, vectors, and geo features instead of stitching those behaviors together from separate tools.

If you are new to search tooling, the easiest mental model is:

- A `DocumentIndex` stores your documents.
- Each `TextFieldIndex` indexes one field such as `title`, `body`, or `tags`.
- A JSON request describes what you want to match.
- `searchJsonDsl(...)` returns an OpenSearch-style response with `hits`, `highlight`, and `aggregations`.

## Why it is broader than a fuzzy-only library

- It indexes structured fields instead of only flat strings.
- It supports both TF-IDF and BM25 ranking.
- It exposes `BoolQuery` with `should`, `must`, `filter`, `mustNot`, and `minimumShouldMatch`.
- It includes dedicated `PrefixQuery`, `TermsQuery`, `ExistsQuery`, and `MultiMatchQuery` building blocks.
- It supports terms aggregations and significant terms for discovery.
- It includes `VectorFieldIndex`, `SparseVectorFieldIndex`, and `GeoFieldIndex` for non-lexical retrieval.

## Common problems it can solve

If you are evaluating fit, use this matrix instead of guessing from the API names.

| Use Case | Description | Features |
| --- | --- | --- |
| Text search | Find the right page, article, product, or record from normal keyword queries. | [TF-IDF and BM25 Ranking](./../ranking/tfidf-and-bm25-ranking.md), [Term, Terms, Prefix, Exists, and Match Queries](./../lexical-querying/term-terms-prefix-exists-and-match-queries.md), [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](./../lexical-querying/bool-query.md), [Highlighting with Querylight TS](./../features/highlighting-with-querylight-ts.md) |
| Search as you type | Show useful matches while somebody is still typing. | [SimpleTextSearch for Plain JSON Documents](./../features/simple-text-search-for-plain-json-documents.md), [Trie-Backed Prefix Expansion](./../indexing/trie-backed-prefix-expansion.md), [How To Build Autocomplete](./../guides/how-to-build-autocomplete.md) |
| Did you mean | Recover from typos, partial words, and slightly wrong queries. | [SimpleTextSearch for Plain JSON Documents](./../features/simple-text-search-for-plain-json-documents.md), [Approximate Nearest Neighbor Vector Search](./../features/approximate-nearest-neighbor-vector-search.md), [Reciprocal Rank Fusion](./../ranking/reciprocal-rank-fusion.md) |
| Related documents | Show similar articles, help pages, products, or records. | [Approximate Nearest Neighbor Vector Search](./../features/approximate-nearest-neighbor-vector-search.md), [Document Chunking Strategies](./../features/document-chunking-strategies.md), [Vector Rescoring for Faster Hybrid Search](./../features/vector-rescoring-for-faster-hybrid-search.md) |
| Ask the docs | Answer natural-language questions by retrieving the most relevant chunks first. | [Approximate Nearest Neighbor Vector Search](./../features/approximate-nearest-neighbor-vector-search.md), [Document Chunking Strategies](./../features/document-chunking-strategies.md), [Vector Rescoring for Faster Hybrid Search](./../features/vector-rescoring-for-faster-hybrid-search.md), [Ask the Docs End to End](./../demo/ask-the-docs-end-to-end.md) |
| Sparse neural search | Run learned token-weight retrieval when your model emits sparse vectors instead of dense embeddings. | [Sparse Vector Search](./../features/sparse-vector-search.md), [Reciprocal Rank Fusion](./../ranking/reciprocal-rank-fusion.md), [Ask the Docs End to End](./../demo/ask-the-docs-end-to-end.md) |
| Faceting | Let users narrow results by tags, sections, categories, ranges, or counts. | [Terms Aggregation](./../discovery/terms-aggregation.md), [Significant Terms Aggregation](./../discovery/significant-terms-aggregation.md), [Range Aggregation](./../discovery/range-aggregation.md), [Histogram Aggregation](./../discovery/histogram-aggregation.md), [Date Histogram Aggregation](./../discovery/date-histogram-aggregation.md), [How To Build Faceted Navigation](./../guides/how-to-build-faceted-navigation.md) |
| Filtered search | Combine text queries with hard constraints such as section, product type, date, or status. | [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](./../lexical-querying/bool-query.md), [NumericFieldIndex and DateFieldIndex for Structured Features](./../indexing/numeric-and-date-fields.md), [RangeQuery Over Lexical Fields](./../lexical-querying/range-query-over-lexical-fields.md) |
| Dashboards | Slice and explore local data with counts, buckets, and ranked result lists. | [Using Querylight TS as a Local Analytics Engine](./../guides/using-querylight-ts-as-a-local-analytics-engine.md), [From Raw API Payloads to Browser Dashboards](./../guides/from-raw-api-payloads-to-browser-dashboards.md), [Build Interactive ECharts Dashboards from Plain JSON](./../guides/building-echarts-dashboards-from-plain-json.md), [Terms Aggregation](./../discovery/terms-aggregation.md), [Stats Aggregation](./../discovery/stats-aggregation.md) |
| Hybrid search | Blend lexical ranking with dense or sparse vectors instead of picking one retrieval model. | [Reciprocal Rank Fusion](./../ranking/reciprocal-rank-fusion.md), [Vector Rescoring for Faster Hybrid Search](./../features/vector-rescoring-for-faster-hybrid-search.md), [Sparse Vector Search](./../features/sparse-vector-search.md), [Approximate Nearest Neighbor Vector Search](./../features/approximate-nearest-neighbor-vector-search.md) |
| Geo-aware search | Find results inside a point radius, map area, or polygon. | [Geo Indexing with Points and Polygons](./../features/geo-indexing-with-points-and-polygons.md), [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](./../lexical-querying/bool-query.md) |
| Static-site search shipped to the browser | Build indexes ahead of time and ship them with your site or app. | [Portable JSON Index State](./../indexing/portable-json-index-state.md), [Serialization, Hydration, and Shipping Indexes](./../indexing/serialization-hydration-and-shipping-indexes.md), [Getting Started with Browser Search](./getting-started-with-browser-search.md) |

## Minimal setup

```ts
import { DocumentIndex, searchJsonDsl, TextFieldIndex } from "@tryformation/querylight-ts";

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

const response = await searchJsonDsl({
  index,
  request: {
    query: { match_all: {} },
    size: 10
  }
});
```

Expected result:

```ts
response.hits.hits[0];
// {
//   _id: "intro",
//   _score: 1,
//   _source: {
//     title: ["Querylight TS"],
//     body: ["Portable search for browser and Node.js"]
//   }
// }
```

That score is mainly useful for ordering. The important part is that each hit already carries the document id and source payload in an OpenSearch-style envelope.

## What the result ids are for

Search returns ids first, not your full source objects. That keeps the index compact and lets you decide how to store and render your actual documents.

Typical pattern:

```ts
const sourceDocuments = new Map([
  ["intro", { title: "Querylight TS", url: "/docs/intro" }]
]);

const results = response.hits.hits.map((hit) => ({
  ...sourceDocuments.get(hit._id),
  score: hit._score
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
- Replace `match_all` with `match`, `match_phrase`, `bool`, or vector clauses.
- Use aggregations to build facets from the current result set.
- Add dense vectors for semantic search or related-content features.
- Add sparse vectors when your model emits learned token weights.
- Serialize the index at build time and load it in the browser.

## More guides

- [Choosing a Schema for Search](./../schema/choosing-a-schema-for-search.md)
- [OpenSearch-Style JSON DSL Search](./../features/json-dsl-search.md)
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
