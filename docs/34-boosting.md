---
id: boosting-query
section: Queries
title: BoostingQuery for Soft Demotion Instead of Hard Exclusion
summary: Keep relevant documents in the results while pushing down candidates that carry undesirable signals.
tags: [query, boosting, relevance, ranking, demotion]
apis: [BoostingQuery, MatchQuery, TermQuery, BoolQuery]
level: advanced
order: "34"
---

# BoostingQuery for Soft Demotion Instead of Hard Exclusion

`BoostingQuery` models a common search need: some documents are relevant, but some of those relevant documents should rank lower because they also match a negative signal.

This is different from `mustNot`.

- `mustNot` removes documents entirely
- `BoostingQuery` keeps them, but reduces their score

## Basic shape

`BoostingQuery` takes:

- a positive query
- a negative query
- a `negativeBoost` multiplier between `0` and `1`

```ts
import { BoostingQuery, MatchQuery, TermQuery } from "@tryformation/querylight-ts";

const query = new BoostingQuery(
  new MatchQuery("title", "querylight"),
  new TermQuery("tags", "deprecated"),
  0.2
);
```

Here, documents matching `title:querylight` still qualify. If they also have the `deprecated` tag, their score is multiplied by `0.2`.

## Good uses

- Demote archived or deprecated content.
- Lower the rank of stale docs while still returning them.
- Penalize low-quality signals such as "generated", "draft", or "duplicate".
- Prefer canonical documents without hiding alternates completely.

## Compared with bool logic

If you already know a document should never appear, use `mustNot`.

If the document is still acceptable but should lose ranking priority, use `BoostingQuery`.

```ts
const query = new BoostingQuery(
  new MatchQuery("body", "vector search"),
  new BoolQuery([], [], [new TermQuery("status", "draft")]),
  0.3
);
```

## Tuning advice

- Start with `negativeBoost` around `0.2` to `0.5`.
- Smaller values create harsher demotion.
- If the negative signal should behave like a strict rule, use `mustNot` instead.
