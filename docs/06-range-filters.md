---
id: range-filters
section: Queries
title: RangeQuery Over Lexical Fields
summary: Filter sortable string terms with gt, gte, lt, and lte boundaries.
tags: [query, range, filters, ordering, facets]
apis: [RangeQuery, TextFieldIndex, DocumentIndex]
level: querying
order: "06"
city: Lisbon
lat: 38.7223
lon: -9.1393
---

# RangeQuery Over Lexical Fields

`RangeQuery` compares string terms lexically. That works best when values are already sortable as strings.

## Example

```ts
import { BoolQuery, RangeQuery } from "@querylight/core";

const query = new BoolQuery([], [], [
  new RangeQuery("order", { gte: "03", lte: "07" })
]);
```

## Practical note

If you want numeric-style ordering, store values as zero-padded strings such as `01`, `02`, and `10`.
