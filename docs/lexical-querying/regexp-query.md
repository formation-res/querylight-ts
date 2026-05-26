---
id: regexp-query
section: Lexical Querying
title: RegexpQuery for Term-Level Regular Expressions
summary: Match indexed terms with JavaScript regular expressions when wildcard patterns are not expressive enough, using the JSON DSL first.
tags: [query, regex, regexp, term-level, pattern-matching]
apis: [RegexpQuery, WildcardQuery, TermQuery]
level: advanced
order: 80
---

# RegexpQuery for Term-Level Regular Expressions

`regexp` matches indexed terms with a JavaScript `RegExp` or regex pattern string.

Like `WildcardQuery`, this is term-level behavior. It does not run full-text analysis over the query text.

## Basic example

```json
{
  "query": {
    "regexp": {
      "title": "^quer"
    }
  }
}
```

## When to use it

- Power-user filters
- Pattern-heavy identifiers
- Cases where `WildcardQuery` is too limited

## Regexp vs Wildcard

- `wildcard` is simpler and easier to reason about
- `regexp` is more expressive

Prefer `wildcard` if simple `*` and `?` are enough.

## Notes

- Matching is done against indexed terms.
- Querylight removes the `g` flag from regex objects to avoid stateful repeated-search bugs.
- Broad regexes can match many terms, so keep them deliberate.
