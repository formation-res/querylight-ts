# Querylight TS

Pure TypeScript port of the Kotlin `querylight` library, packaged for browsers and Node.js.

Querylight TS is a lightweight in-process search toolkit for static sites, browser apps, and Node.js projects that need more than fuzzy matching but less than a full search server. It combines structured indexing, lexical ranking, boolean queries, aggregations, vector search, and geo search behind one small API. Read the full introduction in [`docs/00-introducing-querylight-ts.md`](docs/00-introducing-querylight-ts.md).

## Workspace Layout

- `packages/querylight`: the library package (`@querylight/core`)
- `apps/demo`: a browser demo built with Vite

## Features

- In-memory reverse index for structured documents
- TF-IDF and BM25 ranking
- Reciprocal rank fusion for combining lexical, geo, filter, and vector results
- Boolean, term, range, phrase, prefix, and match-all queries
- Analyzer/tokenizer/token-filter pipeline
- Trie-backed prefix expansion
- Aggregations and significant terms
- Approximate nearest-neighbour vector search
- Basic geo point/polygon queries
- Portable JSON-serializable index state

## Documentation

- [Introducing Querylight TS](docs/00-introducing-querylight-ts.md)
- [Documentation overview](docs/01-overview.md)

## Commands

```bash
npm install
npm test
npm run build
npm run dev
```

## Positioning

This is intended as a broader client-side search toolkit than fuzzy-match-only libraries such as `fuse.js`: it combines ranking, boolean logic, phrase search, prefixes, aggregations, vector search, and geo support behind one small pure TypeScript API.
