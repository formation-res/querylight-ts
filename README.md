# Querylight TS

[![npm version](https://img.shields.io/npm/v/%40tryformation%2Fquerylight-ts)](https://www.npmjs.com/package/@tryformation/querylight-ts)
[![build status](https://github.com/formation-res/querylight-ts/workflows/Test%20and%20Deploy%20Demo/badge.svg)](https://github.com/formation-res/querylight-ts/actions/workflows/ci-demo-deploy.yml)

Pure TypeScript port of the Kotlin `querylight` library, packaged for browsers and Node.js.

Querylight TS is a lightweight in-process search toolkit for static sites, browser apps, and Node.js projects that need more than fuzzy matching but less than a full search server. It combines structured indexing, BM25/TF-IDF ranking, boolean queries, advanced relevance tuning, aggregations, vector search, hybrid reranking, highlighting, and geo search behind one small API.

In practice, that means it is an easy way to build semantic-search features locally without introducing a separate vector database or search service. You can use it to power search experiences such as "Ask the Docs", related-article suggestions, semantic reranking on top of lexical results, typo-tolerant content discovery, faceted navigation, and map- or region-aware retrieval.

It is one of the few browser-first TypeScript search toolkits that brings together structured search-engine-style querying and lightweight vector search in the same local package.

Project links:

- Documentation index: [`docs/index.md`](docs/index.md)
- Project introduction: [`docs/overview/introduction.md`](docs/overview/introduction.md)

## Use Cases

Querylight TS can cover a wide range of local search problems without forcing you into a backend search stack.

- Docs search and site search: `TextFieldIndex`, `MatchQuery`, `MultiMatchQuery`, BM25 ranking, highlighting, and serialized indexes.
- Semantic "Ask the Docs" experiences: `VectorFieldIndex`, chunked content, vector retrieval, and `VectorRescoreQuery` for lexical-first reranking.
- Related articles and recommendations: document or chunk embeddings with vector similarity.
- Faceted navigation and filtered discovery: `BoolQuery`, `TermsQuery`, aggregations, and significant terms.
- Product or catalog search: BM25 ranking, fielded search, hard filters, prefixes, and optional hybrid reranking.
- Typo-tolerant search boxes: `bigramVector`, ngram analyzers, prefix queries, and hybrid lexical plus vector patterns.
- Geo-aware search: `GeoFieldIndex`, `GeoPointQuery`, and `GeoPolygonQuery`.
- Browser-shipped search for static content: JSON-serializable index state and build-time precomputation.
- Search behavior testing and tuning: stable query objects, ranking controls, and a testable in-memory model.

## Try The Demo

Play with the live search demo on Cloudflare Pages:

- [https://querylight-ts-demo.pages.dev](https://querylight-ts-demo.pages.dev)

Use it to try the search experience, inspect the indexed documentation, and get a feel for lexical, vector, and structured search behavior in the browser.

## Workspace Layout

- `packages/querylight`: the library package (`@tryformation/querylight-ts`)
- `apps/demo`: a browser demo built with Vite

## Features

- In-memory reverse index for structured documents
- TF-IDF and BM25 ranking
- Reciprocal rank fusion for combining lexical, geo, filter, and vector results
- Boolean, term, terms, wildcard, regex, exists, range, phrase, prefix, multi-match, dis-max, boosting, and match-all queries
- Numeric/date field indexes plus distance-feature, rank-feature, and JS script scoring queries
- Beginner-friendly plain JSON indexing with `simpleTextSearch`
- Offset-based exact, phrase, prefix, and fuzzy highlighting
- Analyzer/tokenizer/token-filter pipeline
- Trie-backed prefix expansion
- Aggregations and significant terms
- Approximate nearest-neighbour vector search
- Basic geo point/polygon queries
- Portable JSON-serializable index state

## Documentation

- [Documentation index](docs/index.md)
- [Introducing Querylight TS](docs/overview/introduction.md)
- [Comparing Querylight TS to other browser search libraries](docs/overview/browser-search-library-comparison.md)
- [Getting started with browser search](docs/overview/getting-started-with-browser-search.md)
- [Documentation overview](docs/overview/what-querylight-ts-covers.md)
- [Analyzer and tokenization deep dive](docs/analysis/analyzer-and-tokenization-deep-dive.md)
- [Choosing a schema for search](docs/schema/choosing-a-schema-for-search.md)
- [How to build autocomplete](docs/guides/how-to-build-autocomplete.md)
- [How to build faceted navigation](docs/guides/how-to-build-faceted-navigation.md)
- [Relevance tuning with BM25, TF-IDF, and RRF](docs/ranking/relevance-tuning.md)
- [DisMaxQuery for best-field scoring](docs/lexical-querying/dis-max-query.md)
- [BoostingQuery for soft demotion](docs/lexical-querying/boosting-query.md)
- [WildcardQuery for term-level patterns](docs/lexical-querying/wildcard-query.md)
- [RegexpQuery for regex term matching](docs/lexical-querying/regexp-query.md)
- [DistanceFeatureQuery for recency and closeness boosts](docs/ranking/distance-feature-query.md)
- [RankFeatureQuery for numeric relevance signals](docs/ranking/rank-feature-query.md)
- [ScriptQuery for custom JavaScript filters](docs/lexical-querying/script-query.md)
- [ScriptScoreQuery for custom JavaScript scoring](docs/ranking/script-score-query.md)
- [NumericFieldIndex and DateFieldIndex](docs/indexing/numeric-and-date-fields.md)
- [Document chunking strategies](docs/features/document-chunking-strategies.md)
- [Serialization, hydration, and shipping indexes](docs/indexing/serialization-hydration-and-shipping-indexes.md)
- [Performance and memory tuning](docs/operations/performance-and-memory-tuning.md)
- [Testing search behavior](docs/operations/testing-search-behavior.md)
- [Real-world recipes](docs/guides/real-world-recipes.md)
- [Other work related to Querylight TS](docs/overview/other-work-related-to-querylight-ts.md)
- [Ask the Docs end to end](docs/demo/ask-the-docs-end-to-end.md)
- [How the tag aggregations sidebar works](docs/demo/tag-aggregations-sidebar.md)
- [Highlighting with Querylight TS](docs/features/highlighting-with-querylight-ts.md)

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

This is intended as a broader client-side search toolkit than fuzzy-match-only libraries such as `fuse.js`: it combines ranking, boolean logic, multi-field search, phrase search, prefixes, aggregations, vector search, and geo support behind one small pure TypeScript API. For a fuller comparison with `fuse.js`, Lunr, MiniSearch, FlexSearch, Pagefind, and Orama, see [the comparison article](docs/overview/browser-search-library-comparison.md).

## Project Notes

Parts of this project were developed with AI-assisted agentic coding tools, with design, review, and release decisions still made manually.

Most of the documentation was also AI-generated. That serves two practical purposes: it makes it possible to provide comprehensive coverage of the library's broad feature set without spending disproportionate time writing docs by hand, and it provides a large enough corpus for the [demo application](https://querylight-ts-demo.pages.dev) to showcase vector search through the "Ask the Docs" feature.
