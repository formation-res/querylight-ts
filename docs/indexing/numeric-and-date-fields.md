---
id: numeric-and-date-fields
section: Indexing
title: NumericFieldIndex and DateFieldIndex for Structured Features
summary: Map numeric and date fields explicitly so range, distance, and feature scoring behave predictably.
tags: [indexing, numeric, date, range, ranking]
apis: [NumericFieldIndex, DateFieldIndex, RangeQuery, RankFeatureQuery, DistanceFeatureQuery]
level: advanced
order: 40
---

# NumericFieldIndex and DateFieldIndex for Structured Features

`NumericFieldIndex` and `DateFieldIndex` are structured field types for non-text values.

They are the right choice when a field is meant to behave like:

- a number
- a timestamp
- a sortable/rangeable feature

## Why use dedicated field indexes

Text indexes treat values as analyzed terms.

That is fine for lexical fields, but feature-oriented fields are better expressed as dedicated numeric/date indexes so that:

- range queries behave numerically
- recency and distance scoring are explicit
- rank-feature scoring reads directly from indexed values

## Example

```ts
import {
  DateFieldIndex,
  DocumentIndex,
  NumericFieldIndex
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  popularity: new NumericFieldIndex(),
  publishedAt: new DateFieldIndex()
});

index.index({
  id: "1",
  fields: {
    popularity: ["42"],
    publishedAt: ["2025-01-05T00:00:00.000Z"]
  }
});
```

## Queries that benefit

- `RangeQuery`
- `DistanceFeatureQuery`
- `RankFeatureQuery`
- `ScriptQuery` / `ScriptScoreQuery` via `numericValue()` and `numericValues()`

## Notes

- Values are still provided through the normal document `fields` object as strings.
- `DateFieldIndex` stores parsed timestamps internally.
- If a value cannot be parsed, it is ignored by the numeric/date index.
