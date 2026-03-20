---
id: getting-started
section: Overview
title: Getting Started with Browser Search
summary: Build a practical search box quickly with either the beginner helper or the equivalent manual setup.
tags: [getting-started, browser, simple, search, serialization]
apis: [createSimpleTextSearchIndex, simpleTextSearch, DocumentIndex, TextFieldIndex, MatchPhrase, MatchQuery, reciprocalRankFusion]
level: foundation
order: "16"
city: Utrecht
lat: 52.0907
lon: 5.1214
---

# Getting Started with Browser Search

This guide is for somebody who has never used a search library before and wants a usable search box quickly.

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

## Equivalent manual setup

The beginner helper is just a convenience layer around the lower-level primitives.

This is the same idea done manually:

```ts
import {
  Analyzer,
  BoolQuery,
  DocumentIndex,
  EdgeNgramsTokenFilter,
  MatchPhrase,
  MatchQuery,
  NgramTokenFilter,
  OP,
  RankingAlgorithm,
  TextFieldIndex,
  reciprocalRankFusion
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

function search(query: string) {
  const lexicalHits = index.searchRequest({
    query: new BoolQuery([
      new MatchPhrase("title", query, 1, 8),
      new MatchPhrase("description", query, 2, 3),
      new MatchPhrase("body", query, 2, 3),
      new MatchQuery("title", query, OP.AND, false, 6),
      new MatchQuery("description", query, OP.AND, false, 2.5),
      new MatchQuery("body", query, OP.AND, false, 2.0),
      new MatchQuery("primarySuggest", query, OP.OR, true, 4),
      new MatchQuery("secondarySuggest", query, OP.OR, true, 2)
    ]),
    limit: 20
  });

  const fuzzyHits = fuzzyIndex.searchRequest({
    query: new MatchQuery("combined", query, OP.OR, false, 1.5),
    limit: 20
  });

  return reciprocalRankFusion([lexicalHits, fuzzyHits], {
    rankConstant: 20,
    weights: [3, 1]
  });
}
```

The manual version is useful when:

- you want different boosts
- you want different fuzzy behavior
- you need filters or faceting
- you want to mix in vector or geo search later

## Recommended browser architecture

For a production static site or browser app, do the indexing at build time.

### Build step

In a Node.js build script:

```ts
import fs from "node:fs/promises";
import { createSimpleTextSearchIndex } from "@tryformation/querylight-ts";

const documents = await loadYourDocsSomehow();
const search = createSimpleTextSearchIndex({
  documents,
  primaryFields: ["title"],
  secondaryFields: ["description", "body"]
});

const payload = {
  search: {
    idField: search.idField,
    primaryFields: search.primaryFields,
    secondaryFields: search.secondaryFields,
    ranking: search.ranking,
    documentIndexState: JSON.parse(JSON.stringify(search.documentIndex.indexState)),
    fuzzyIndexState: JSON.parse(JSON.stringify(search.fuzzyIndex.indexState))
  },
  documents
};

await fs.writeFile("dist/search-index.json", JSON.stringify(payload));
```

### Browser step

In the browser:

```ts
import { createSimpleTextSearchIndex, DocumentIndex, RankingAlgorithm, TextFieldIndex, simpleTextSearch } from "@tryformation/querylight-ts";

const payload = await fetch("/search-index.json").then((response) => response.json());

const search = createSimpleTextSearchIndex({
  documents: payload.documents,
  primaryFields: payload.search.primaryFields,
  secondaryFields: payload.search.secondaryFields,
  idField: payload.search.idField,
  ranking: payload.search.ranking as RankingAlgorithm
});

const hydratedSearch = {
  ...search,
  documentIndex: search.documentIndex.loadState(payload.search.documentIndexState),
  fuzzyIndex: search.fuzzyIndex.loadState(payload.search.fuzzyIndexState)
};

const hits = simpleTextSearch(hydratedSearch, { query: "range fi", limit: 5 });

const query = new MatchQuery("title", "range filters");
const highlighted = hydratedSearch.documentIndex.highlight(hits[0]![0], query, {
  fields: ["title", "body"]
});
```

This pattern keeps the browser simple:

- fetch prebuilt JSON
- hydrate the indices
- run search on each keystroke or submit
- render matching documents from the original payload

## When to move beyond the beginner helper

Stay with `simpleTextSearch` if you need a fast, practical default.

Move to manual queries when you need:

- filters or facets
- field-specific boosts tuned to your content
- custom analyzers for tags, IDs, or code snippets
- hybrid lexical plus vector retrieval
- geo queries

The important point is that the beginner path is not a dead end. It gets you to a useful search box quickly, and the same library lets you grow from there.

For highlight-specific behavior and current limitations, see [Highlighting with Querylight TS](./17-highlighting.md).
