---
id: bool-logic
section: Queries
title: BoolQuery for Must, Should, Filter, and MustNot
summary: Blend ranking clauses with strict filters and exclusions in one request.
tags: [query, bool, filtering, must, must-not]
apis: [BoolQuery, MatchQuery, TermQuery, QueryContext]
level: querying
order: "04"
city: London
lat: 51.5072
lon: -0.1276
---

# BoolQuery for Must, Should, Filter, and MustNot

`BoolQuery` is the main way to combine ranking clauses with hard constraints.

## Structure

- `should`: contributes score
- `must`: required to appear
- `filter`: required but not intended for scoring logic
- `mustNot`: excluded documents

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

## Good use cases

- Search content but restrict to a section.
- Hide advanced entries in an onboarding view.
- Combine phrase-heavy title matches with broader body matches.

## Learn more

- [Boolean model of information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Boolean_model_of_information_retrieval)
