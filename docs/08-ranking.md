---
id: ranking
section: Ranking
title: TF-IDF and BM25 Ranking
summary: Choose between classic term weighting and Lucene-style BM25 scoring.
tags: [ranking, bm25, tfidf, scoring, relevance]
apis: [RankingAlgorithm, TextFieldIndex, defaultBm25Config]
level: foundation
order: "08"
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
import { RankingAlgorithm, TextFieldIndex } from "@tryformation/querylight-ts";

const bm25 = new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25);
const tfidf = new TextFieldIndex(undefined, undefined, RankingAlgorithm.TFIDF);
```

The docs browser keeps both indexes live and lets you switch between them from the toolbar.

## Learn more

- [TF-IDF on Wikipedia](https://en.wikipedia.org/wiki/Tf%E2%80%93idf)
- [Okapi BM25 on Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
- [The Probabilistic Relevance Framework: BM25 and Beyond](https://ir.webis.de/anthology/2009.ftir_journal-ir0anthology0volumeA3A4.0/)
