---
id: ranking
section: Ranking
title: TF-IDF and BM25 Ranking
summary: Choose between classic term weighting and Lucene-style BM25 scoring.
tags: [ranking, bm25, tfidf, scoring, relevance]
apis: [RankingAlgorithm, TextFieldIndex, defaultBm25Config]
level: foundation
order: "08"
city: Stockholm
lat: 59.3293
lon: 18.0686
---

# TF-IDF and BM25 Ranking

`TextFieldIndex` supports two ranking algorithms.

## BM25

- Better default for mixed-length content
- Common search-engine ranking baseline
- Configurable with `k1` and `b`

## TF-IDF

- Simple and familiar
- Useful for debugging or comparison

```ts
import { RankingAlgorithm, TextFieldIndex } from "@querylight/core";

const bm25 = new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25);
const tfidf = new TextFieldIndex(undefined, undefined, RankingAlgorithm.TFIDF);
```

The docs browser keeps both indexes live and lets you switch between them from the toolbar.
