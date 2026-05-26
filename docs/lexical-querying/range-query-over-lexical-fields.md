---
id: range-filters
section: Lexical Querying
title: RangeQuery Over Lexical Fields
summary: Filter sortable string terms with gt, gte, lt, and lte boundaries through the JSON DSL.
tags: [query, range, filters, ordering, facets]
apis: [RangeQuery, TextFieldIndex, DocumentIndex]
level: querying
order: 40
---

# RangeQuery Over Lexical Fields

`range` compares string terms lexically. That works best when values are already sortable as strings.

## Example

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "order": {
              "gte": "03",
              "lte": "07"
            }
          }
        }
      ]
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { BoolQuery, RangeQuery } from "@tryformation/querylight-ts";

const query = new BoolQuery({
  filter: [new RangeQuery({ field: "order", range: { gte: "03", lte: "07" } })]
});
```

## Practical note

If you want numeric-style ordering, store values as zero-padded strings such as `01`, `02`, and `10`.

## Learn more

- [Lexicographic order on Wikipedia](https://en.wikipedia.org/wiki/Lexicographic_order)
