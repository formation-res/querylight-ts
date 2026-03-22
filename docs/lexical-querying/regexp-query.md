---
id: regexp-query
section: Lexical Querying
title: RegexpQuery for Term-Level Regular Expressions
summary: Match indexed terms with JavaScript regular expressions when wildcard patterns are not expressive enough.
tags: [query, regex, regexp, term-level, pattern-matching]
apis: [RegexpQuery, WildcardQuery, TermQuery]
level: advanced
order: 80
---

# RegexpQuery for Term-Level Regular Expressions

`RegexpQuery` matches indexed terms with a JavaScript `RegExp` or regex pattern string.

Like `WildcardQuery`, this is term-level behavior. It does not run full-text analysis over the query text.

## Basic example

```ts
import { DocumentIndex, RegexpQuery, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex()
});

index.index({ id: "1", fields: { title: ["querylight"] } });
index.index({ id: "2", fields: { title: ["query planner"] } });
index.index({ id: "3", fields: { title: ["vector search"] } });

const hits = index.searchRequest({
  query: new RegexpQuery({ field: "title", pattern: "^quer" })
});
```

## When to use it

- Power-user filters
- Pattern-heavy identifiers
- Cases where `WildcardQuery` is too limited

## Regexp vs Wildcard

- `WildcardQuery` is simpler and easier to reason about
- `RegexpQuery` is more expressive

Prefer `WildcardQuery` if simple `*` and `?` are enough.

## Notes

- Matching is done against indexed terms.
- Querylight removes the `g` flag from regex objects to avoid stateful repeated-search bugs.
- Broad regexes can match many terms, so keep them deliberate.
