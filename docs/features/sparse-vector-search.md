---
id: sparse-vector-search
section: Other Features
title: Sparse Vector Search
summary: Use SparseVectorFieldIndex for OpenSearch-style learned sparse retrieval with token-weight vectors.
tags: [sparse, retrieval, opensearch, neural-search, vector]
apis: [SparseVectorFieldIndex, sparseInnerProduct]
level: advanced
order: 35
---

# Sparse Vector Search

`SparseVectorFieldIndex` stores token-weight maps and scores them with an exact inner product.

This matches the core shape used by OpenSearch neural sparse retrieval: documents and queries become sparse vectors where each non-zero entry is a weighted token.

## Basic usage

```ts
import { SparseVectorFieldIndex } from "@tryformation/querylight-ts";

const index = new SparseVectorFieldIndex();

index.insert("doc-1", [{
  "1878": 1.2,
  "3945": 0.8,
  "7120": 0.4
}]);

index.insert("doc-2", [{
  "1012": 1.4,
  "3945": 0.3
}]);

const hits = index.query({
  "3945": 2.0,
  "1878": 1.0
}, 5);
```

The score is the sum of matching token weights across the overlapping dimensions.

## How it works

Unlike dense vectors, sparse vectors do not compare every dimension.

The index keeps an inverted posting list per token and only touches documents that share at least one query token. That makes the retrieval path feel more like an inverted index than a dense embedding scan.

If a document stores multiple sparse vectors, Querylight TS keeps the best score per document, similar to how `VectorFieldIndex` keeps the best dense-vector hit.

## When to use it

Use sparse retrieval when:

- you want a retrieval mode that stays closer to lexical inverted-index behavior
- your model emits weighted token expansions instead of dense embeddings
- you want to compare lexical, sparse, and dense retrieval as separate modes

Use dense vectors instead when the model naturally produces dense embeddings and you want semantic similarity across the whole representation space.

## Trade-offs

This first implementation is intentionally small:

- retrieval is exact, not sparse ANN
- Querylight TS stores sparse vectors as plain JSON-friendly token-weight maps
- model inference is outside the library; you supply the sparse vectors

That means the library stays browser-friendly and easy to serialize, but it does not try to reproduce the full OpenSearch execution stack.

## Related articles

- [Approximate Nearest Neighbor Vector Search](./approximate-nearest-neighbor-vector-search.md)
- [Vector Rescoring for Faster Hybrid Search](./vector-rescoring-for-faster-hybrid-search.md)
- [Ask the Docs End to End](./../demo/ask-the-docs-end-to-end.md)
