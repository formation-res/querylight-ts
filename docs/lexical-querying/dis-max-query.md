---
id: dis-max
section: Lexical Querying
title: DisMaxQuery for Best-Field Matching with Tie Breakers
summary: Prefer the strongest matching clause while still giving partial credit to secondary matches.
tags: [query, ranking, dis-max, relevance, multi-field]
apis: [DisMaxQuery, MatchQuery, MultiMatchQuery, TermQuery]
level: advanced
order: 50
---

# DisMaxQuery for Best-Field Matching with Tie Breakers

`DisMaxQuery` is useful when several clauses describe alternative ways a document might be relevant, but you want the best one to dominate the score.

This is especially common for "best field" search:

- exact title hit
- strong subtitle hit
- weaker body hit

Instead of summing every clause like a bool `should`, `DisMaxQuery` keeps the highest clause score and optionally blends in some of the others with a `tieBreaker`.

## Basic shape

```ts
import { DisMaxQuery, MatchQuery, OP } from "@tryformation/querylight-ts";

const query = new DisMaxQuery({
  queries: [
    new MatchQuery({ field: "title", text: "portable browser search", operation: OP.AND, boost: 3.0 }),
    new MatchQuery({ field: "tagline", text: "portable browser search", operation: OP.AND, boost: 2.0 }),
    new MatchQuery({ field: "body", text: "portable browser search", operation: OP.AND, boost: 1.0 })
  ]
});
```

## Tie breaker behavior

`tieBreaker` should be between `0` and `1`.

- `0`: only the best matching clause counts
- `0.2`: the best clause counts fully, weaker matching clauses add a small bonus
- `1`: behaves more like summing all matching clauses

```ts
const query = new DisMaxQuery({
  queries: [
    new MatchQuery({ field: "title", text: "vector search", operation: OP.AND, boost: 3.0 }),
    new MatchQuery({ field: "body", text: "vector search", operation: OP.AND, boost: 1.0 })
  ],
  tieBreaker: 0.2
});
```

That means a document with a strong title hit still wins, but a document that also matches in the body gets a small extra push.

## When to use it

- Search the same text across title, summary, and body but avoid over-rewarding duplicate matches.
- Prefer exact/high-value fields while still noticing supporting evidence elsewhere.
- Build "best field" relevance without manually tuning a large bool query.

## Bool vs DisMax

- `BoolQuery` with `should` clauses is additive.
- `DisMaxQuery` is winner-takes-most.

If you want one field to dominate and others to contribute only lightly, `DisMaxQuery` is usually the better fit.
