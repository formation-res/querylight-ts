---
id: getting-started
section: Overview
title: Getting Started with Browser Search
summary: Build a practical search box quickly with the JSON DSL first, then drop to the lower-level TypeScript API only when you need it.
tags: [getting-started, browser, simple, search, serialization]
apis: [searchJsonDsl, createSimpleTextSearchIndex, simpleTextSearch, serializeSimpleTextSearchIndex, deserializeSimpleTextSearchIndex, DocumentIndex, TextFieldIndex]
level: foundation
order: 30
---

# Getting Started with Browser Search

This guide is for somebody who has never used a search library before and wants a usable search box quickly.

It is also the quickest way to understand what Querylight TS is good at in practice. Even if you start with a simple search box, the same library can later grow into:

- docs or site search with highlighting
- dense-vector semantic retrieval over chunked content
- sparse-vector retrieval over learned token-weight maps
- related-article suggestions
- faceted or filtered discovery
- geo-aware search

That matters because beginner-friendly search tooling often becomes a dead end as soon as your requirements grow. In Querylight TS, you can keep the same documents, build-time JSON payload, and browser hydration flow when you later switch to JSON DSL requests and additional field types.

There are two paths:

- Use the beginner helper and get something working fast.
- Build the equivalent setup manually if you want to understand what the helper does.

For most people, the right architecture is:

1. Collect your content at build time.
2. Build the search indexes in Node.js.
3. Serialize the index state to JSON.
4. Ship that JSON with your site or app.
5. Load the prebuilt index in the browser and use it to power a search field.

That avoids indexing work in the browser and gives you a fast startup path.

## Pick the path that matches your use case

- If you want a practical docs or content search box fast, start with `createSimpleTextSearchIndex`.
- If you know you need filters, facets, dense retrieval, sparse retrieval, or custom ranking, use the JSON DSL directly.
- If you are unsure, start simple. You can keep the same document model and move to DSL requests later.

## Fastest path: beginner helper

Use `createSimpleTextSearchIndex` when you have plain JSON documents and you just want a reasonable default.

```ts
import { createSimpleTextSearchIndex, simpleTextSearch } from "@tryformation/querylight-ts";

const documents = [
  {
    id: "range-filters",
    title: "RangeQuery Over Lexical Fields",
    description: "Use lexical ranges over sortable string values.",
    body: "RangeQuery compares string terms lexically and works well with sortable values."
  },
  {
    id: "phrase-search",
    title: "Phrase Search and Slop",
    description: "Match analyzed terms in order with optional movement tolerance.",
    body: "Phrase search checks whether analyzed terms occur in sequence."
  }
];

const search = createSimpleTextSearchIndex({
  documents,
  primaryFields: ["title"],
  secondaryFields: ["description", "body"]
});

const hits = simpleTextSearch(search, { query: "range fi", limit: 5 });
```

What this gives you:

- stronger ranking for primary fields such as `title`
- secondary matches from `description` and `body`
- prefix recovery for incomplete queries
- fuzzy recovery for typos
- reciprocal rank fusion between the lexical and fuzzy branches

If you stop here, you already have a practical site-search baseline.

If you also want result highlighting, treat it as a second step after retrieval. Querylight TS now exposes `documentIndex.highlight(...)` for exact and phrase highlighting against stored source text.

This beginner path is a strong fit for:

- docs and marketing sites
- blogs and magazines
- product help centers
- static app content bundled with a browser build

## Equivalent manual setup with the JSON DSL

The beginner helper is just a convenience layer around the lower-level primitives.

This is the same idea done manually:

Raw request JSON:

```json
{
  "query": {
    "rrf": {
      "rank_constant": 20,
      "weights": [3, 1],
      "queries": [
        {
          "bool": {
            "should": [
              { "match_phrase": { "title": { "query": "range filters", "slop": 1, "boost": 8 } } },
              { "match_phrase": { "description": { "query": "range filters", "slop": 2, "boost": 3 } } },
              { "match_phrase": { "body": { "query": "range filters", "slop": 2, "boost": 3 } } },
              { "match": { "title": { "query": "range filters", "operator": "and", "boost": 6 } } },
              { "match": { "description": { "query": "range filters", "operator": "and", "boost": 2.5 } } },
              { "match": { "body": { "query": "range filters", "operator": "and", "boost": 2 } } },
              { "match": { "primarySuggest": { "query": "range filters", "operator": "or", "prefix_match": true, "boost": 4 } } },
              { "match": { "secondarySuggest": { "query": "range filters", "operator": "or", "prefix_match": true, "boost": 2 } } }
            ]
          }
        },
        {
          "match": {
            "combined": {
              "query": "range filters",
              "operator": "or",
              "boost": 1.5
            }
          }
        }
      ]
    }
  },
  "size": 20
}
```

Send the same shape from TypeScript like this:

```ts
import {
  Analyzer,
  DocumentIndex,
  EdgeNgramsTokenFilter,
  NgramTokenFilter,
  RankingAlgorithm,
  searchJsonDsl,
  TextFieldIndex,
} from "@tryformation/querylight-ts";

const suggestAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 10)]);
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);

const index = new DocumentIndex({
  title: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25),
  description: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25),
  body: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25),
  primarySuggest: new TextFieldIndex(suggestAnalyzer, suggestAnalyzer, RankingAlgorithm.BM25),
  secondarySuggest: new TextFieldIndex(suggestAnalyzer, suggestAnalyzer, RankingAlgorithm.BM25)
});

const fuzzyIndex = new DocumentIndex({
  combined: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, RankingAlgorithm.BM25)
});

for (const doc of documents) {
  index.index({
    id: doc.id,
    fields: {
      title: [doc.title],
      description: [doc.description],
      body: [doc.body],
      primarySuggest: [doc.title],
      secondarySuggest: [doc.description, doc.body].join(" ")
    }
  });

  fuzzyIndex.index({
    id: doc.id,
    fields: {
      combined: [doc.title, doc.description, doc.body].join(" ")
    }
  });
}

async function search(query: string) {
  const request = {
    query: {
      rrf: {
        rank_constant: 20,
        weights: [3, 1],
        queries: [
          {
            bool: {
              should: [
                { match_phrase: { title: { query, slop: 1, boost: 8 } } },
                { match_phrase: { description: { query, slop: 2, boost: 3 } } },
                { match_phrase: { body: { query, slop: 2, boost: 3 } } },
                { match: { title: { query, operator: "and", boost: 6 } } },
                { match: { description: { query, operator: "and", boost: 2.5 } } },
                { match: { body: { query, operator: "and", boost: 2 } } },
                { match: { primarySuggest: { query, operator: "or", prefix_match: true, boost: 4 } } },
                { match: { secondarySuggest: { query, operator: "or", prefix_match: true, boost: 2 } } }
              ]
            }
          },
          {
            match: {
              combined: {
                query,
                operator: "or",
                boost: 1.5
              }
            }
          }
        ]
      }
    },
    size: 20
  };

  const response = await searchJsonDsl({
    index,
    request
  });

  return response.hits.hits;
}
```

The manual version is useful when:

- you want different boosts
- you want different fuzzy behavior
- you need filters or faceting
- you want to mix in dense vector, sparse vector, or geo search later

It is also the path to take when your product requirements sound more like:

- "search only within this section"
- "show related articles"
- "use embeddings for semantic reranking"
- "use sparse token-weight retrieval"
- "limit results to the visible map area"
- "support strict metadata filters"

If you prefer the lower-level internal API, the same request can still be expressed with query classes. The rest of the docs keep that layer documented, but the primary examples now use the JSON DSL.

## Recommended browser architecture

For a production static site or browser app, do the indexing at build time.

### Build step

In a Node.js build script:

```ts
import fs from "node:fs/promises";
import { createSimpleTextSearchIndex, serializeSimpleTextSearchIndex } from "@tryformation/querylight-ts";

const documents = await loadYourDocsSomehow();
const search = createSimpleTextSearchIndex({
  documents,
  primaryFields: ["title"],
  secondaryFields: ["description", "body"]
});

const compressed = serializeSimpleTextSearchIndex({ index: search });

await fs.writeFile("dist/search-index.json.gz", compressed);
```

### Browser step

In the browser:

```ts
import { deserializeSimpleTextSearchIndex, simpleTextSearch } from "@tryformation/querylight-ts";

const compressed = new Uint8Array(await fetch("/search-index.json.gz").then((response) => response.arrayBuffer()));
const hydratedSearch = deserializeSimpleTextSearchIndex({ compressed });

const hits = simpleTextSearch(hydratedSearch, { query: "range fi", limit: 5 });
```

This pattern keeps the browser simple:

- fetch prebuilt JSON
- hydrate the indices
- run search on each keystroke or submit
- render matching documents from the original payload

## When to move beyond the beginner helper

Stay with `simpleTextSearch` if you need a fast, practical default.

Move to JSON DSL requests when you need:

- filters or facets
- field-specific boosts tuned to your content
- custom analyzers for tags, IDs, or code snippets
- hybrid lexical plus vector retrieval
- geo queries

That transition is normal. Many teams start with a plain site-search box and only later add:

- semantic search over chunked docs
- recommendations or related content
- faceted navigation
- geo or region-based filtering

You do not need to throw away the first implementation when that happens. The same documents, serialized index pattern, and browser-side rendering flow still apply after you move beyond `simpleTextSearch`.

For highlight-specific behavior and current limitations, see [Highlighting with Querylight TS](./../features/highlighting-with-querylight-ts.md).
