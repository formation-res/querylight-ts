---
id: vector-rescoring
section: Advanced
title: Vector Rescoring for Faster Hybrid Search
summary: Rescore only the top lexical candidates with vectors when full vector retrieval would be too broad or too slow.
tags: [vector, rescoring, hybrid-search, performance, ranking]
apis: [VectorRescoreQuery, VectorFieldIndex, MatchQuery, BoolQuery, bigramVector]
level: advanced
order: "32"
---

# Vector Rescoring for Faster Hybrid Search

Full vector retrieval is not always the best first step.

If a lexical or filtered query already narrows the result set to a few hundred documents, it is often faster and easier to:

1. run the normal query first
2. take the top `N` hits
3. rescore only that window with vector similarity

That is the same general idea as Elasticsearch's rescore phase.

## Why this helps

Hybrid search usually has two separate jobs:

- lexical or structured retrieval finds the candidate set
- vector similarity improves the order inside that candidate set

When those jobs are separated, vector work stays bounded. You do not spend time comparing embeddings for documents that were never strong candidates in the first place.

This is a good fit when:

- filters already removed most of the corpus
- lexical search returns a few hundred plausible hits
- you want semantic reranking, not semantic-only retrieval

## Use `VectorRescoreQuery`

`VectorRescoreQuery` wraps another query and rescales only the top window.

```ts
import {
  BoolQuery,
  DocumentIndex,
  MatchQuery,
  TextFieldIndex,
  VectorFieldIndex,
  VectorRescoreQuery,
  bigramVector,
  createSeededRandom
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex(),
  embedding: new VectorFieldIndex(8, 36 * 36, createSeededRandom(42))
});

index.index({ id: "1", fields: { title: ["vector search tutorial"] } });
index.index({ id: "2", fields: { title: ["vector search with filters"] } });
index.index({ id: "3", fields: { title: ["geo search guide"] } });

const embeddingIndex = index.getFieldIndex("embedding") as VectorFieldIndex;
embeddingIndex.insert("1", [bigramVector("vector embeddings tutorial")]);
embeddingIndex.insert("2", [bigramVector("filtered semantic retrieval")]);
embeddingIndex.insert("3", [bigramVector("map polygons and geohashes")]);

const baseQuery = new BoolQuery(
  [],
  [new MatchQuery("title", "vector search")],
  [],
  []
);

const hits = index.search(new VectorRescoreQuery(
  "embedding",
  bigramVector("filtered vector retrieval"),
  baseQuery,
  {
    windowSize: 100,
    queryWeight: 1.0,
    rescoreQueryWeight: 1.0
  }
));
```

What happens:

- `baseQuery` determines the candidate list
- only the top `100` results are rescored with vector similarity
- results after that window keep their original lexical order

## Choosing the window size

Start with a small window and expand only if you need more semantic movement near the top.

Typical ranges:

- `25` to `50` for tight UI search boxes
- `100` to `200` for broader docs or catalog search
- larger only when the lexical stage is still too noisy near the top

If you already have a few hundred hits after filters, rescoring the top `100` is often a better tradeoff than running broad vector retrieval across all of them.

## Hybrid search: cheap filters first, vector scoring second

This is usually the best high-level pattern:

1. apply cheap structured constraints first
2. optionally apply geo filtering
3. run lexical retrieval inside that reduced set
4. rescore the top window with vectors

The important idea is that boolean filters and geo constraints are often much cheaper than vector similarity over a broad candidate pool.

### Example with filters and geo

```ts
import {
  BoolQuery,
  GeoPolygonQuery,
  MatchQuery,
  TermQuery,
  VectorRescoreQuery,
  bigramVector,
  rectangleToPolygon
} from "@tryformation/querylight-ts";

const baseQuery = new BoolQuery(
  [],
  [new MatchQuery("title", "coffee shop")],
  [
    new TermQuery("city", "berlin"),
    new GeoPolygonQuery("location", rectangleToPolygon(13.35, 52.48, 13.45, 52.55))
  ],
  []
);

const hits = index.search(new VectorRescoreQuery(
  "embedding",
  bigramVector("quiet place for espresso and work"),
  baseQuery,
  { windowSize: 75 }
));
```

This does three useful things:

- non-Berlin documents are removed before vector work starts
- documents outside the map area are removed before vector work starts
- only the best lexical matches inside that filtered region are rescored

That is often the right pattern for:

- local search
- product catalogs with hard facet filters
- documentation search scoped to one product area
- recommendation flows with strict eligibility rules

## Why this matters for performance

Suppose the full corpus has `50,000` documents.

- a category filter might reduce that to `2,000`
- a geo filter might reduce that to `300`
- lexical ranking might put the best `75` candidates at the top
- vector rescoring then runs only on those `75`

That is a much smaller and more purposeful workload than trying to run vector retrieval as the first step across everything.

## When to use rescoring instead of direct vector retrieval

Prefer rescoring when:

- exact terms and filters matter
- lexical recall is already decent
- you want Elasticsearch-style reranking behavior

Prefer direct vector retrieval when:

- the initial lexical query misses too many relevant documents
- similarity is the main retrieval signal
- you are doing related-content or recommendation lookup without a strong text query

## Related patterns

- Use [Approximate Nearest Neighbor Vector Search](./10-vector-search.md) for direct vector retrieval.
- Use [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](./04-bool-logic.md) to build the cheap prefilter stage.
- Use [Geo Indexing with Points and Polygons](./11-geo-search.md) when a map or region constraint should narrow the candidate set before vector scoring.
- Use [Reciprocal Rank Fusion](./14-reciprocal-rank-fusion.md) when you want to combine separate ranked lists instead of rescoring one candidate window.
- Use [Relevance Tuning with BM25, TF-IDF, and RRF](./24-relevance-tuning.md) when ranking quality is the broader problem.
