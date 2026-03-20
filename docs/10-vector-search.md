---
id: vector-search
section: Advanced
title: Approximate Nearest Neighbor Vector Search
summary: Use VectorFieldIndex and bigramVector for lightweight semantic-ish lookup.
tags: [vector, aknn, lsh, bigram, fuzzy]
apis: [VectorFieldIndex, bigramVector, cosineSimilarity, hashFunction]
level: advanced
order: "10"
city: Prague
lat: 50.0755
lon: 14.4378
---

# Approximate Nearest Neighbor Vector Search

`VectorFieldIndex` stores embeddings and retrieves approximate nearest neighbors with locality-sensitive hashing.

## Character bigram vectors

The built-in `bigramVector` helper is practical for typo-tolerant text similarity.

```ts
import { VectorFieldIndex, bigramVector, createSeededRandom } from "@querylight/core";

const vectorIndex = new VectorFieldIndex(6, 36 * 36, createSeededRandom(42));
vectorIndex.insert("doc-1", [bigramVector("vector search and typo tolerance")]);

const hits = vectorIndex.query(bigramVector("vectro serch"), 5);
```

## Why the demo uses it

The vector mode helps recover documentation pages even when the query spelling is poor or the exact lexical phrase is missing.
