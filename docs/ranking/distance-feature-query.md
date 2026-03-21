---
id: distance-feature-query
section: Ranking
title: DistanceFeatureQuery for Recency and Numeric Closeness
summary: Boost documents by how close a numeric or date field is to an origin value.
tags: [ranking, distance-feature, recency, numeric, date]
apis: [DistanceFeatureQuery, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 40
---

# DistanceFeatureQuery for Recency and Numeric Closeness

`DistanceFeatureQuery` scores documents by proximity to an origin value.

That makes it useful for:

- recency boosts over dates
- closeness boosts over prices, years, or distances

## Map the field correctly

For best behavior, index the field with `NumericFieldIndex` or `DateFieldIndex`.

```ts
import {
  DateFieldIndex,
  DistanceFeatureQuery,
  DocumentIndex
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  publishedAt: new DateFieldIndex()
});

index.index({ id: "1", fields: { publishedAt: ["2025-01-01T00:00:00.000Z"] } });
index.index({ id: "2", fields: { publishedAt: ["2025-01-05T00:00:00.000Z"] } });
index.index({ id: "3", fields: { publishedAt: ["2025-02-01T00:00:00.000Z"] } });

const hits = index.searchRequest({
  query: new DistanceFeatureQuery(
    "publishedAt",
    "2025-01-04T00:00:00.000Z",
    7 * 24 * 60 * 60 * 1000
  )
});
```

## How scoring works

The score uses:

```ts
pivot / (pivot + distance)
```

That means:

- exact matches get the strongest score
- farther values decay smoothly
- `pivot` controls how quickly the decay happens

## Good uses

- Prefer fresher articles.
- Prefer products close to a target price.
- Prefer events near a selected day.

## Notes

- `origin` can be a number, date string, or `Date`.
- `pivot` must be greater than `0`.
- If the field is not mapped as numeric/date, Querylight falls back to parsing raw field values.
