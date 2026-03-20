---
id: vector-search
section: Advanced
title: Approximate Nearest Neighbor Vector Search
summary: Use VectorFieldIndex and bigramVector for lightweight semantic-ish lookup.
tags: [vector, aknn, lsh, bigram, fuzzy]
apis: [VectorFieldIndex, bigramVector, cosineSimilarity, hashFunction]
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

## Why the demo uses it

The demo uses vector search in two different ways:

- lightweight bigram vectors for typo-tolerant relatedness in the main search experience
- transformer embeddings for the "Ask the Docs" semantic question flow

For the full end-to-end walkthrough, see [Ask the Docs End to End](./18-ask-the-docs.md).

## Learn more

- [Nearest neighbor search on Wikipedia](https://en.wikipedia.org/wiki/Nearest_neighbor_search)
- [Locality-sensitive hashing on Wikipedia](https://en.wikipedia.org/wiki/Locality-sensitive_hashing)
- [Approximate Nearest Neighbor: Towards Removing the Curse of Dimensionality](https://www.theoryofcomputing.org/articles/v008a014/v008a014.pdf)
