---
id: wildcard-query
section: Lexical Querying
title: WildcardQuery for Term-Level Pattern Matching
summary: Match indexed terms with `*` and `?` patterns without switching to full-text analysis, using the JSON DSL first.
tags: [query, wildcard, term-level, pattern-matching]
apis: [WildcardQuery, TermQuery, PrefixQuery]
level: advanced
order: 70
---

# WildcardQuery for Term-Level Pattern Matching

`wildcard` matches indexed terms using simple wildcard syntax:

- `*` matches zero or more characters
- `?` matches exactly one character

This is a term-level query. It works against analyzed terms that already exist in the index.

## Basic example

```json
{
  "query": {
    "wildcard": {
      "title": "que*"
    }
  }
}
```

## When to use it

- Match families of tags or codes.
- Support simple power-user patterns.
- Search normalized keyword-like values with a little flexibility.

## Wildcard vs MatchQuery

- `match` analyzes the input text and uses lexical ranking.
- `wildcard` checks indexed terms directly.

If you want normal search-box behavior, use `match`.
If you want pattern matching over already-indexed terms, use `wildcard`.

## Notes

- Wildcards operate on analyzed terms, not raw source strings.
- Broad leading wildcards such as `*light` may match many terms.
- For simple prefix use cases, `PrefixQuery` is usually clearer.
