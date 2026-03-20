---
id: overview
section: Overview
title: What Querylight TS Covers
summary: A compact browser and Node.js search toolkit for structured, explainable retrieval.
tags: [overview, bm25, tfidf, document-index, browser]
apis: [DocumentIndex, TextFieldIndex, MatchAll, RankingAlgorithm]
level: foundation
order: "01"
city: Berlin
lat: 52.52
lon: 13.405
---

# What Querylight TS Covers

Querylight TS is a pure TypeScript search toolkit for browsers and Node.js. It combines text retrieval, structured boolean queries, multi-field search, phrase search, prefix expansion, aggregations, vector search, geo search, and portable index state under one API.

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

## Learn more

- [Information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Information_retrieval)
- [Okapi BM25 on Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
