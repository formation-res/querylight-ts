---
id: wildcard-query
section: Queries
title: WildcardQuery for Term-Level Pattern Matching
summary: Match indexed terms with `*` and `?` patterns without switching to full-text analysis.
tags: [query, wildcard, term-level, pattern-matching]
apis: [WildcardQuery, TermQuery, PrefixQuery]
level: intermediate
order: "35"
---

# WildcardQuery for Term-Level Pattern Matching

`WildcardQuery` matches indexed terms using simple wildcard syntax:

- `*` matches zero or more characters
- `?` matches exactly one character

This is a term-level query. It works against analyzed terms that already exist in the index.

## Basic example

```ts
import { DocumentIndex, TextFieldIndex, WildcardQuery } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex()
});

index.index({ id: "1", fields: { title: ["querylight"] } });
index.index({ id: "2", fields: { title: ["query planner"] } });
index.index({ id: "3", fields: { title: ["vector search"] } });

const hits = index.searchRequest({
  query: new WildcardQuery("title", "que*")
});
```

## When to use it

- Match families of tags or codes.
- Support simple power-user patterns.
- Search normalized keyword-like values with a little flexibility.

## Wildcard vs MatchQuery

- `MatchQuery` analyzes the input text and uses lexical ranking.
- `WildcardQuery` checks indexed terms directly.

If you want normal search-box behavior, use `MatchQuery`.
If you want pattern matching over already-indexed terms, use `WildcardQuery`.

## Notes

- Wildcards operate on analyzed terms, not raw source strings.
- Broad leading wildcards such as `*light` may match many terms.
- For simple prefix use cases, `PrefixQuery` is usually clearer.
