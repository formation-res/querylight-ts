---
id: json-dsl-search
section: Other Features
title: OpenSearch-Style JSON DSL Search
summary: Parse and run OpenSearch-style JSON search requests with queries, highlights, aggregations, geo, vector, and script clauses.
tags: [json, dsl, opensearch, elasticsearch, query, aggregation]
apis: [searchJsonDsl, parseJsonDslQuery, KnnQuery, SparseVectorQuery, VectorRescoreQuery]
level: advanced
order: 15
---

# OpenSearch-Style JSON DSL Search

Querylight TS now includes a JSON request layer for teams that prefer request objects over class-based query construction.

The JSON DSL is modeled after the OpenSearch and Elasticsearch request format as closely as the current feature set allows.

## Basic search request

Raw request JSON:

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "title": {
              "query": "vector search",
              "operator": "and"
            }
          }
        }
      ],
      "filter": [
        {
          "term": {
            "tags": "tutorial"
          }
        }
      ]
    }
  },
  "from": 0,
  "size": 10,
  "highlight": {
    "fields": {
      "title": {},
      "body": {
        "fragment_size": 120
      }
    }
  },
  "aggs": {
    "tags": {
      "terms": {
        "field": "tags",
        "size": 10
      }
    },
    "prices": {
      "stats": {
        "field": "price"
      }
    }
  }
}
```

Send that request from TypeScript like this:

```ts
import { searchJsonDsl } from "@tryformation/querylight-ts";

const request = {
  query: {
    bool: {
      must: [
        { match: { title: { query: "vector search", operator: "and" } } }
      ],
      filter: [
        { term: { tags: "tutorial" } }
      ]
    }
  },
  from: 0,
  size: 10,
  highlight: {
    fields: {
      title: {},
      body: { fragment_size: 120 }
    }
  },
  aggs: {
    tags: { terms: { field: "tags", size: 10 } },
    prices: { stats: { field: "price" } }
  }
};

const response = await searchJsonDsl({ index, request });
```

The response shape follows the familiar OpenSearch layout:

- `took`
- `hits.total`
- `hits.max_score`
- `hits.hits`
- `aggregations`

## Supported query clauses

- `match_all`
- `term`
- `terms`
- `match`
- `multi_match`
- `match_phrase`
- `prefix`
- `wildcard`
- `regexp`
- `exists`
- `range`
- `bool`
- `dis_max`
- `boosting`
- `geo_shape`
- `geo_point`
- `geo_polygon`
- `distance_feature`
- `rank_feature`
- `script`
- `script_score`
- `rrf`
- `knn`
- `neural_sparse` and `sparse_vector`
- `vector_rescore`
- `sparse_vector_rescore`

## Supported aggregations

- `terms`
- `significant_terms`
- `value_count`
- `min`
- `max`
- `sum`
- `avg`
- `stats`
- `range`
- `histogram`
- `date_histogram`

## Notes

- `searchJsonDsl(...)` is the main entrypoint for full request execution.
- `parseJsonDslQuery({ query: ... })` parses one query clause into the equivalent Querylight query object.
- Script clauses use JavaScript expressions in `script.source`.
- Reciprocal rank fusion is available via the `rrf` clause.
- Dense vector retrieval uses `knn`.
- Sparse retrieval accepts both `neural_sparse` and `sparse_vector`.
- Beginner-search bundles created by `createSimpleTextSearchIndex(...)` can be executed with a top-level `simple_text_search` request.
- Per-hit `_source` comes from `StoredSourceIndex` when your `DocumentIndex` mapping includes `_source: new StoredSourceIndex()`.
- Without `StoredSourceIndex`, the fallback `_source` for plain `DocumentIndex` searches is the indexed field map.
- `SimpleTextSearchIndex` responses still return the original source object because that helper keeps the input documents around.

If you prefer the existing TypeScript-first API, the class-based query types remain fully supported.
