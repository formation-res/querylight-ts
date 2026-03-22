---
id: bool-logic
section: Lexical Querying
title: BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch
summary: Blend ranking clauses with strict filters, exclusions, and optional should-logic in one request.
tags: [query, bool, filtering, must, must-not]
apis: [BoolQuery, MatchQuery, TermQuery, QueryContext]
level: querying
order: 20
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

const query = new BoolQuery({
  should: [
    new MatchQuery({ field: "title", text: "phrase search", operation: OP.AND, boost: 3.0 }),
    new MatchQuery({ field: "body", text: "phrase search", operation: OP.AND, boost: 1.5 })
  ],
  filter: [new TermQuery({ field: "section", text: "Queries" })],
  mustNot: [new TermQuery({ field: "level", text: "advanced" })]
});
```

## minimumShouldMatch

Use `minimumShouldMatch` when you want a specific number of `should` clauses to become mandatory.

```ts
const query = new BoolQuery({
  should: [
    new MatchQuery({ field: "title", text: "vector" }),
    new MatchQuery({ field: "body", text: "search" }),
    new MatchQuery({ field: "tags", text: "ranking" })
  ],
  minimumShouldMatch: 2
});
```

## Good use cases

- Search content but restrict to a section.
- Hide advanced entries in an onboarding view.
- Combine phrase-heavy title matches with broader body matches.
- Promote preferred matches without filtering out the rest.
- Require two or more optional signals before a document is accepted.

## Learn more

- [Boolean model of information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Boolean_model_of_information_retrieval)
