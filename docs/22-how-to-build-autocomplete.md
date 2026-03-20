---
id: how-to-build-autocomplete
section: How-To
title: How To Build Autocomplete
summary: Use prefix-friendly fields, compact suggestion text, and stable ranking for search-as-you-type.
tags: [autocomplete, prefix, suggestions, search-as-you-type, edge-ngrams]
apis: [DocumentIndex, TextFieldIndex, EdgeNgramsTokenFilter, MatchQuery, PrefixQuery]
level: foundation
order: "22"
---

# How To Build Autocomplete

Autocomplete is a different retrieval problem from full search. Users type short, incomplete queries and expect useful results immediately.

The simplest reliable pattern is:

- build a dedicated suggestion field
- index short high-signal text into it
- use prefix-friendly analysis
- keep result rendering compact

## Create a suggestion field

```ts
import {
  Analyzer,
  DocumentIndex,
  EdgeNgramsTokenFilter,
  TextFieldIndex,
  MatchQuery
} from "@tryformation/querylight-ts";

const suggestAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);

const index = new DocumentIndex({
  title: new TextFieldIndex(),
  suggest: new TextFieldIndex(suggestAnalyzer, suggestAnalyzer)
});

index.index({
  id: "1",
  fields: {
    title: ["Range Filters"],
    suggest: ["Range Filters query filtering bounds"]
  }
});

const hits = index.searchRequest({
  query: new MatchQuery("suggest", "ran"),
  limit: 5
});
```

## Keep suggestion text focused

A suggestion field should not contain the entire body text. It works better when it contains:

- title
- tags
- api names
- a few high-signal keywords

That keeps short queries from matching too much irrelevant text.

## Prefix queries vs edge ngrams

There are two useful approaches:

- `PrefixQuery` over indexed vocabulary
- `MatchQuery` against an edge-ngram field

The edge-ngram approach is often more forgiving in typeahead UIs because it behaves like regular text search on a prefix-oriented field.

## Ranking tips

Autocomplete feels better when:

- exact title matches rise first
- short labels beat long paragraphs
- metadata noise stays low

A common pattern is to query `title` and `suggest` separately and then prefer title-heavy hits in the UI.

## UI guidance

Good autocomplete is not just retrieval.

- show 5 to 10 results, not 50
- render titles clearly
- highlight the matching part if possible
- let the full search page handle deeper exploration

## A practical recipe

For documentation or catalog search:

1. build `title`, `tags`, and `suggest` fields
2. fill `suggest` with title plus a few keywords
3. query only `suggest` while typing
4. switch to broader search after submit

That split keeps the typeahead fast and predictable.
