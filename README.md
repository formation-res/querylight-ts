# Querylight TS

[![npm version](https://img.shields.io/npm/v/%40tryformation%2Fquerylight-ts)](https://www.npmjs.com/package/@tryformation/querylight-ts)
[![build status](https://github.com/formation-res/querylight-ts/workflows/Test%20and%20Deploy%20Demo/badge.svg)](https://github.com/formation-res/querylight-ts/actions/workflows/ci-demo-deploy.yml)

Pure TypeScript port of the Kotlin `querylight` library, packaged for browsers and Node.js.

Querylight TS is an in-process search toolkit for static sites, browser apps, and Node.js projects that need more than fuzzy matching but do not want a separate search server. It is positioned as the most feature-rich local search library in this category: BM25 and TF-IDF ranking, structured queries, aggregations, highlighting, geo search, dense vector search, sparse vector search, and hybrid reranking behind one API.

The vector story is a first-class part of the library:

- dense vector search with `VectorFieldIndex` for semantic retrieval, ANN lookup, related-content features, and vector rescoring
- sparse vector search with `SparseVectorFieldIndex` for learned token-weight retrieval in the style of OpenSearch neural sparse search
- hybrid search patterns that combine lexical retrieval with dense or sparse vector ranking

That makes it practical to ship lexical, dense, sparse, and hybrid search locally in one package instead of stitching together multiple narrower tools.

Project links:

- Documentation: [`docs/`](docs/)
- Demo: [https://querylight.tryformation.com/](https://querylight.tryformation.com/)

## Use Cases

Querylight TS can cover a wide range of local search problems without forcing you into a backend search stack.

| Use Case | Description | Features |
| --- | --- | --- |
| Text search | Find the right page, document, or product from normal keyword queries. | [TF-IDF and BM25 Ranking](docs/ranking/tfidf-and-bm25-ranking.md), [Term, Terms, Prefix, Exists, and Match Queries](docs/lexical-querying/term-terms-prefix-exists-and-match-queries.md), [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](docs/lexical-querying/bool-query.md), [Highlighting with Querylight TS](docs/features/highlighting-with-querylight-ts.md) |
| Search as you type | Show useful matches while somebody is still typing. | [SimpleTextSearch for Plain JSON Documents](docs/features/simple-text-search-for-plain-json-documents.md), [Trie-Backed Prefix Expansion](docs/indexing/trie-backed-prefix-expansion.md), [How To Build Autocomplete](docs/guides/how-to-build-autocomplete.md) |
| Did you mean | Recover from typos, partial words, and slightly wrong queries. | [SimpleTextSearch for Plain JSON Documents](docs/features/simple-text-search-for-plain-json-documents.md), [Approximate Nearest Neighbor Vector Search](docs/features/approximate-nearest-neighbor-vector-search.md), [Reciprocal Rank Fusion](docs/ranking/reciprocal-rank-fusion.md) |
| Related documents | Show similar articles, products, help pages, or records. | [Approximate Nearest Neighbor Vector Search](docs/features/approximate-nearest-neighbor-vector-search.md), [Document Chunking Strategies](docs/features/document-chunking-strategies.md), [Vector Rescoring for Faster Hybrid Search](docs/features/vector-rescoring-for-faster-hybrid-search.md) |
| Ask the docs | Answer natural-language questions by retrieving the most relevant chunks first. | [Approximate Nearest Neighbor Vector Search](docs/features/approximate-nearest-neighbor-vector-search.md), [Document Chunking Strategies](docs/features/document-chunking-strategies.md), [Vector Rescoring for Faster Hybrid Search](docs/features/vector-rescoring-for-faster-hybrid-search.md), [Ask the Docs End to End](docs/demo/ask-the-docs-end-to-end.md) |
| Sparse neural search | Run learned token-weight retrieval when your model emits sparse vectors instead of dense embeddings. | [Sparse Vector Search](docs/features/sparse-vector-search.md), [Reciprocal Rank Fusion](docs/ranking/reciprocal-rank-fusion.md), [Ask the Docs End to End](docs/demo/ask-the-docs-end-to-end.md) |
| Faceting | Let users narrow results by tags, sections, categories, ranges, or counts. | [Terms Aggregation](docs/discovery/terms-aggregation.md), [Significant Terms Aggregation](docs/discovery/significant-terms-aggregation.md), [Range Aggregation](docs/discovery/range-aggregation.md), [Histogram Aggregation](docs/discovery/histogram-aggregation.md), [Date Histogram Aggregation](docs/discovery/date-histogram-aggregation.md), [How To Build Faceted Navigation](docs/guides/how-to-build-faceted-navigation.md) |
| Filtered search | Combine full-text queries with hard constraints such as section, product type, date, or status. | [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](docs/lexical-querying/bool-query.md), [NumericFieldIndex and DateFieldIndex for Structured Features](docs/indexing/numeric-and-date-fields.md), [RangeQuery Over Lexical Fields](docs/lexical-querying/range-query-over-lexical-fields.md) |
| Dashboards | Slice and explore local data with counts, buckets, and ranked result lists. | [Using Querylight TS as a Local Analytics Engine](docs/guides/using-querylight-ts-as-a-local-analytics-engine.md), [From Raw API Payloads to Browser Dashboards](docs/guides/from-raw-api-payloads-to-browser-dashboards.md), [Build Interactive ECharts Dashboards from Plain JSON](docs/guides/building-echarts-dashboards-from-plain-json.md), [Terms Aggregation](docs/discovery/terms-aggregation.md), [Stats Aggregation](docs/discovery/stats-aggregation.md) |
| Hybrid search | Blend lexical ranking with dense or sparse vectors instead of picking one retrieval model. | [Reciprocal Rank Fusion](docs/ranking/reciprocal-rank-fusion.md), [Vector Rescoring for Faster Hybrid Search](docs/features/vector-rescoring-for-faster-hybrid-search.md), [Sparse Vector Search](docs/features/sparse-vector-search.md), [Approximate Nearest Neighbor Vector Search](docs/features/approximate-nearest-neighbor-vector-search.md) |
| Geo-aware search | Find results inside a point radius, map area, or polygon. | [Geo Indexing with Points and Polygons](docs/features/geo-indexing-with-points-and-polygons.md), [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](docs/lexical-querying/bool-query.md) |
| Static-site search shipped to the browser | Build indexes ahead of time and ship them with your site or app. | [Portable JSON Index State](docs/indexing/portable-json-index-state.md), [Serialization, Hydration, and Shipping Indexes](docs/indexing/serialization-hydration-and-shipping-indexes.md), [Getting Started with Browser Search](docs/overview/getting-started-with-browser-search.md) |

## Try The Demo

Play with the live search demo on Cloudflare Pages:

- [https://querylight.tryformation.com/](https://querylight.tryformation.com/)

Use it to try the search experience, inspect the indexed documentation, and compare lexical, dense vector, sparse vector, and hybrid retrieval in the browser.

## Workspace Layout

- `packages/querylight`: the library package (`@tryformation/querylight-ts`)
- `apps/demo`: a Hugo-based static demo site with generated docs content and bundled client-side enhancements

## Features

- In-memory reverse index for structured documents
- TF-IDF and BM25 ranking
- Reciprocal rank fusion for combining lexical, geo, filter, and vector results
- Dense vector retrieval with `VectorFieldIndex`
- Sparse vector retrieval with `SparseVectorFieldIndex`
- Hybrid retrieval with vector rescoring and rank fusion
- Boolean, term, terms, wildcard, regex, exists, range, phrase, prefix, multi-match, dis-max, boosting, and match-all queries
- Numeric/date field indexes plus distance-feature, rank-feature, and JS script scoring queries
- Beginner-friendly plain JSON indexing with `simpleTextSearch`
- Offset-based exact, phrase, prefix, and fuzzy highlighting
- Analyzer/tokenizer/token-filter pipeline
- Trie-backed prefix expansion
- Aggregations and significant terms
- Approximate nearest-neighbour dense vector search
- Basic geo point/polygon queries
- Portable JSON-serializable index state

## Dense And Sparse Vector Search

Querylight TS supports two different vector retrieval models.

- Dense vectors use `VectorFieldIndex`. This is the right fit for embeddings, semantic similarity, related-content features, ANN lookup, and lexical-first reranking with `VectorRescoreQuery`.
- Sparse vectors use `SparseVectorFieldIndex`. This is the right fit when your model produces token-weight maps and you want a retrieval path closer to an inverted index.
- Hybrid search works with both. You can fuse lexical and vector result sets with `reciprocalRankFusion(...)`, or retrieve lexically first and rescore a smaller candidate window with vectors.

Start here if vector search is the reason you are evaluating the library:

- Dense vector search: [docs/features/approximate-nearest-neighbor-vector-search.md](docs/features/approximate-nearest-neighbor-vector-search.md)
- Sparse vector search: [docs/features/sparse-vector-search.md](docs/features/sparse-vector-search.md)
- Hybrid reranking: [docs/features/vector-rescoring-for-faster-hybrid-search.md](docs/features/vector-rescoring-for-faster-hybrid-search.md)
- Demo internals: [docs/demo/ask-the-docs-end-to-end.md](docs/demo/ask-the-docs-end-to-end.md)

## Documentation

Browse the documentation in [`docs/`](docs/) and try the live demo at [https://querylight.tryformation.com/](https://querylight.tryformation.com/).

## Install

Install the published package in another project with:

```bash
npm install @tryformation/querylight-ts
```

For local development in this repository:

```bash
npm install
```

## Beginner Path

If you want a reasonable default without composing your own queries, use `createSimpleTextSearchIndex` and `simpleTextSearch`:

```ts
import { createSimpleTextSearchIndex, simpleTextSearch } from "@tryformation/querylight-ts";

const search = createSimpleTextSearchIndex({
  documents: [
    {
      id: "intro",
      title: "Querylight TS",
      description: "Portable browser and Node.js search",
      body: "A compact search toolkit with BM25, phrase search, and fuzzy recovery."
    }
  ],
  primaryFields: ["title"],
  secondaryFields: ["description", "body"]
});

const hits = simpleTextSearch(search, { query: "portble sear", limit: 5 });
```

If you need highlight fragments, run highlighting as a second step on the returned ids:

```ts
import { MatchQuery } from "@tryformation/querylight-ts";

const query = new MatchQuery("title", "range filters");
const hits = search.documentIndex.searchRequest({ query, limit: 5 });
const highlight = search.documentIndex.highlight(hits[0]![0], query, {
  fields: ["title", "body"]
});
```

## Commands

```bash
npm install
npm test
npm run build
npm run dev
```

## Positioning

This is intended as a broader client-side search toolkit than fuzzy-match-only libraries such as `fuse.js`: it combines ranking, boolean logic, multi-field search, phrase search, prefixes, aggregations, dense vector search, sparse vector search, and geo support behind one small pure TypeScript API. For a fuller comparison with `fuse.js`, Lunr, MiniSearch, FlexSearch, Pagefind, and Orama, see [the comparison article](docs/overview/browser-search-library-comparison.md).

## Project Notes

Parts of this project were developed with AI-assisted agentic coding tools, with design, review, and release decisions still made manually.

Most of the documentation was also AI-generated. That makes broad docs coverage easier to maintain, and it provides a large enough corpus for the [demo application](https://querylight.tryformation.com/) to showcase lexical, dense-vector, sparse-vector, and hybrid search modes.
