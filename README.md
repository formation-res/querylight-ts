# Querylight TS

[![npm version](https://img.shields.io/npm/v/%40tryformation%2Fquerylight-ts)](https://www.npmjs.com/package/@tryformation/querylight-ts)
[![build status](https://github.com/formation-res/querylight-ts/workflows/Test%20and%20Deploy%20Demo/badge.svg)](https://github.com/formation-res/querylight-ts/actions/workflows/ci-demo-deploy.yml)

Pure TypeScript port of the Kotlin `querylight` library, packaged for browsers and Node.js.

Querylight TS is a lightweight in-process search toolkit for static sites, browser apps, and Node.js projects that need more than fuzzy matching but less than a full search server. It combines structured indexing, lexical ranking, boolean queries, aggregations, vector search, and geo search behind one small API. Read the full introduction in [`docs/00-introducing-querylight-ts.md`](docs/00-introducing-querylight-ts.md).

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
- Boolean, term, terms, exists, range, phrase, prefix, multi-match, and match-all queries
- Beginner-friendly plain JSON indexing with `simpleTextSearch`
- Offset-based exact, phrase, prefix, and fuzzy highlighting
- Analyzer/tokenizer/token-filter pipeline
- Trie-backed prefix expansion
- Aggregations and significant terms
- Approximate nearest-neighbour vector search
- Basic geo point/polygon queries
- Portable JSON-serializable index state

## Documentation

- [Introducing Querylight TS](docs/00-introducing-querylight-ts.md)
- [Comparing Querylight TS to other browser search libraries](docs/31-browser-search-library-comparison.md)
- [Getting started with browser search](docs/16-getting-started.md)
- [Documentation overview](docs/01-overview.md)
- [Analyzer and tokenization deep dive](docs/21-analyzer-deep-dive.md)
- [Choosing a schema for search](docs/20-schema-design.md)
- [How to build autocomplete](docs/22-how-to-build-autocomplete.md)
- [How to build faceted navigation](docs/23-how-to-build-faceted-navigation.md)
- [Relevance tuning with BM25, TF-IDF, and RRF](docs/24-relevance-tuning.md)
- [Document chunking strategies](docs/25-document-chunking-strategies.md)
- [Serialization, hydration, and shipping indexes](docs/26-shipping-indexes.md)
- [Performance and memory tuning](docs/27-performance-and-memory-tuning.md)
- [Testing search behavior](docs/28-testing-search-behavior.md)
- [Real-world recipes](docs/29-real-world-recipes.md)
- [Other work related to Querylight TS](docs/30-other-related-work.md)
- [Ask the Docs end to end](docs/18-ask-the-docs.md)
- [How the tag aggregations sidebar works](docs/19-tag-aggregations-sidebar.md)
- [Highlighting with Querylight TS](docs/17-highlighting.md)

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

This is intended as a broader client-side search toolkit than fuzzy-match-only libraries such as `fuse.js`: it combines ranking, boolean logic, multi-field search, phrase search, prefixes, aggregations, vector search, and geo support behind one small pure TypeScript API. For a fuller comparison with `fuse.js`, Lunr, MiniSearch, FlexSearch, Pagefind, and Orama, see [the comparison article](docs/31-browser-search-library-comparison.md).

## Project Notes

Parts of this project were developed with AI-assisted agentic coding tools, with design, review, and release decisions still made manually.

Most of the documentation was also AI-generated. That serves two practical purposes: it makes it possible to provide comprehensive coverage of the library's broad feature set without spending disproportionate time writing docs by hand, and it provides a large enough corpus for the [demo application](https://querylight-ts-demo.pages.dev) to showcase vector search through the "Ask the Docs" feature.
