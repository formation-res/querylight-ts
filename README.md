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

## Install

Install the published package in another project with:

```bash
npm install @tryformation/querylight-ts
```

For local development in this repository:

```bash
npm install
```

## Commands

```bash
npm install
npm test
npm run build
npm run dev
```

## Positioning

This is intended as a broader client-side search toolkit than fuzzy-match-only libraries such as `fuse.js`: it combines ranking, boolean logic, phrase search, prefixes, aggregations, vector search, and geo support behind one small pure TypeScript API.
