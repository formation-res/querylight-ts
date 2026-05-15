---
id: vector-search
section: Other Features
title: Approximate Nearest Neighbor Vector Search
summary: Use VectorFieldIndex and bigramVector for lightweight semantic-ish lookup.
tags: [vector, aknn, lsh, bigram, fuzzy]
apis: [VectorFieldIndex, VectorRescoreQuery, bigramVector, cosineSimilarity, hashFunction]
level: advanced
order: 30
---

# Approximate Nearest Neighbor Vector Search

`VectorFieldIndex` stores embeddings and retrieves approximate nearest neighbors with locality-sensitive hashing.

Beginner version: a vector is just a long list of numbers that represents a piece of text. If two texts mean similar things, their vectors should end up close together. Vector search lets you find "conceptually similar" content, not just exact word overlap.

## Character bigram vectors

The built-in `bigramVector` helper is practical for typo-tolerant text similarity.

```ts
import { VectorFieldIndex, bigramVector, createSeededRandom } from "@tryformation/querylight-ts";

const vectorIndex = new VectorFieldIndex({
  numHashTables: 6,
  dimensions: 36 * 36,
  random: createSeededRandom(42)
});
vectorIndex.insert("doc-1", [bigramVector("vector search and typo tolerance")]);
vectorIndex.insert("doc-2", [bigramVector("phrase queries and highlighting")]);

const hits = vectorIndex.query(bigramVector("vectro serch"), 5);
```

Expected result:

```ts
[
  ["doc-1", /* highest score */],
  ["doc-2", /* lower score */]
]
```

The exact scores depend on the random projections used by the ANN index, but `doc-1` should rank ahead of `doc-2` because it is much closer to the misspelled query.

If you provide an async scorer backend, use `queryAsync(...)` or `rerankAsync(...)` to let that backend run asynchronously while keeping the same retrieval semantics.

## When to use this

Use vector search when:

- you want typo tolerance beyond exact token matching
- you want semantic retrieval with precomputed embeddings
- you want related-article suggestions

Vector retrieval is usually strongest when combined with lexical ranking, filters, or both.

## Use rescoring when lexical search already narrowed things down

If a lexical query or filtered `BoolQuery` still returns hundreds of document hits, full vector retrieval can be more work than you need.

In that case, use [`VectorRescoreQuery`](./vector-rescoring-for-faster-hybrid-search.md) to:

- run the lexical or filtered query first
- keep the top `N` candidates
- rerank only that window with vector similarity

This follows the same basic pattern as Elasticsearch rescoring: use normal retrieval to define the candidate set, then spend vector work only where it can improve the top of the ranking.

## Why the demo uses it

The demo uses vector search in two different ways:

- article-level dense retrieval as a separate ANN search mode in the docs demo
- transformer embeddings for the "Ask the Docs" semantic question flow

For the full end-to-end walkthrough, see [Ask the Docs End to End](./../demo/ask-the-docs-end-to-end.md). For the OpenSearch-style token-weight alternative, see [Sparse Vector Search](./sparse-vector-search.md).

## Current limitations

The current vector implementation is LSH-based and aimed at browser and small in-process use cases.

Current limitations include:

- approximate retrieval uses a simple locality-sensitive hashing approach
- there is no HNSW or IVF-style ANN index yet
- there is no vector quantization or compressed vector storage yet
- filtering and rescoring patterns exist, but integrated vector features are still narrower than in larger search engines

For small local corpora, these tradeoffs are often acceptable. For large vector collections or more demanding ANN workloads, use rescoring to narrow the candidate set first or move to a larger engine with a more advanced ANN implementation.

## Custom scorer backends

`VectorFieldIndex` now separates candidate generation from dense scoring.

The built-in default is a CPU scorer, but advanced users can provide a custom scorer backend via `options.scorer` when constructing the index. That makes it possible to experiment with alternatives such as a WebGPU scorer while keeping the same `VectorFieldIndex` query and rerank API.

Feedback and pull requests are welcome, especially around ANN quality, scorer backends, and vector-specific performance improvements.

## Learn more

- [Vector Rescoring for Faster Hybrid Search](./vector-rescoring-for-faster-hybrid-search.md)
- [Nearest neighbor search on Wikipedia](https://en.wikipedia.org/wiki/Nearest_neighbor_search)
- [Locality-sensitive hashing on Wikipedia](https://en.wikipedia.org/wiki/Locality-sensitive_hashing)
- [Approximate Nearest Neighbor: Towards Removing the Curse of Dimensionality](https://www.theoryofcomputing.org/articles/v008a014/v008a014.pdf)
