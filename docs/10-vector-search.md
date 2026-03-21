---
id: vector-search
section: Advanced
title: Approximate Nearest Neighbor Vector Search
summary: Use VectorFieldIndex and bigramVector for lightweight semantic-ish lookup.
tags: [vector, aknn, lsh, bigram, fuzzy]
apis: [VectorFieldIndex, VectorRescoreQuery, bigramVector, cosineSimilarity, hashFunction]
level: advanced
order: "10"
---

# Approximate Nearest Neighbor Vector Search

`VectorFieldIndex` stores embeddings and retrieves approximate nearest neighbors with locality-sensitive hashing.

Beginner version: a vector is just a long list of numbers that represents a piece of text. If two texts mean similar things, their vectors should end up close together. Vector search lets you find "conceptually similar" content, not just exact word overlap.

## Character bigram vectors

The built-in `bigramVector` helper is practical for typo-tolerant text similarity.

```ts
import { VectorFieldIndex, bigramVector, createSeededRandom } from "@tryformation/querylight-ts";

const vectorIndex = new VectorFieldIndex(6, 36 * 36, createSeededRandom(42));
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

## When to use this

Use vector search when:

- you want typo tolerance beyond exact token matching
- you want semantic retrieval with precomputed embeddings
- you want "related article" suggestions

Do not use it as the only retrieval strategy unless you are sure that is what you want. In practice, vector search is often strongest when combined with lexical ranking, filters, or both.

## Use rescoring when lexical search already narrowed things down

If a lexical query or filtered `BoolQuery` still returns hundreds of document hits, full vector retrieval can be more work than you need.

In that case, use [`VectorRescoreQuery`](./32-vector-rescoring.md) to:

- run the lexical or filtered query first
- keep the top `N` candidates
- rerank only that window with vector similarity

This follows the same basic pattern as Elasticsearch rescoring: use normal retrieval to define the candidate set, then spend vector work only where it can improve the top of the ranking.

## Why the demo uses it

The demo uses vector search in two different ways:

- lightweight bigram vectors for typo-tolerant relatedness in the main search experience
- transformer embeddings for the "Ask the Docs" semantic question flow

For the full end-to-end walkthrough, see [Ask the Docs End to End](./18-ask-the-docs.md).

## Current limitations

The current vector implementation is intentionally lightweight.

That keeps it easy to understand and practical for browser and small in-process use cases, but it also means it does not try to match the full vector-search feature set of engines such as OpenSearch or Elasticsearch.

Current limitations include:

- approximate retrieval is based on a simple locality-sensitive hashing approach
- there is no HNSW or IVF-style ANN index yet
- there is no vector quantization or compressed vector storage yet
- filtering and rescoring patterns exist, but the integrated vector feature set is still smaller than what larger search engines provide

For many browser, static-site, and embedded search scenarios that tradeoff is acceptable. If you need a small pure TypeScript toolkit with vector support, this can already be useful. If you need a larger algorithmic feature set, there is room to grow.

Pull requests are welcome.

## Learn more

- [Vector Rescoring for Faster Hybrid Search](./32-vector-rescoring.md)
- [Nearest neighbor search on Wikipedia](https://en.wikipedia.org/wiki/Nearest_neighbor_search)
- [Locality-sensitive hashing on Wikipedia](https://en.wikipedia.org/wiki/Locality-sensitive_hashing)
- [Approximate Nearest Neighbor: Towards Removing the Curse of Dimensionality](https://www.theoryofcomputing.org/articles/v008a014/v008a014.pdf)
