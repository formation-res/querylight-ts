---
id: bool-logic
section: Queries
title: BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch
summary: Blend ranking clauses with strict filters, exclusions, and optional should-logic in one request.
tags: [query, bool, filtering, must, must-not]
apis: [BoolQuery, MatchQuery, TermQuery, QueryContext]
level: querying
order: "04"
---

# BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch

`BoolQuery` is the main way to combine ranking clauses with hard constraints.

## Structure

- `should`: contributes score
- `must`: required to appear
- `filter`: required but not intended for scoring logic
- `mustNot`: excluded documents

By default, `should` clauses are optional whenever `must` or `filter` is present. If a bool query contains only `should` clauses, at least one should clause must match.

```ts
import { BoolQuery, MatchQuery, OP, TermQuery } from "@tryformation/querylight-ts";

const query = new BoolQuery(
  [
    new MatchQuery("title", "phrase search", OP.AND, false, 3.0),
    new MatchQuery("body", "phrase search", OP.AND, false, 1.5)
  ],
  [],
  [new TermQuery("section", "Queries")],
  [new TermQuery("level", "advanced")]
);
```

## minimumShouldMatch

Use the final constructor parameter when you want a specific number of `should` clauses to become mandatory.

```ts
const query = new BoolQuery(
  [
    new MatchQuery("title", "vector"),
    new MatchQuery("body", "search"),
    new MatchQuery("tags", "ranking")
  ],
  [],
  [],
  [],
  undefined,
  2
);
```

## Good use cases

- Search content but restrict to a section.
- Hide advanced entries in an onboarding view.
- Combine phrase-heavy title matches with broader body matches.
- Promote preferred matches without filtering out the rest.
- Require two or more optional signals before a document is accepted.

## Learn more

- [Boolean model of information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Boolean_model_of_information_retrieval)
