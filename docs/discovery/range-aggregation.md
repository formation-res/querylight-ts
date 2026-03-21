---
id: range-aggregation
section: Discovery
title: Range Aggregation
summary: Bucket numeric or date fields into explicit ranges for faceting and filtered navigation.
tags: [aggregation, range, numeric, date, facets, analytics]
apis: [rangeAggregation, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 27
---

# Range Aggregation

`rangeAggregation(...)` groups numeric or date fields into explicit buckets that you define.

## Basic usage

```ts
const wordCountIndex = index.getFieldIndex("wordCount") as NumericFieldIndex;

const buckets = wordCountIndex.rangeAggregation([
  { key: "short", to: 400 },
  { key: "medium", from: 400, to: 800 },
  { key: "long", from: 800 }
]);
```

Expected shape:

```ts
[
  { key: "short", from: null, to: 400, docCount: 12 },
  { key: "medium", from: 400, to: 800, docCount: 18 },
  { key: "long", from: 800, to: null, docCount: 7 }
]
```

## How it works

`rangeAggregation(...)` uses document-count semantics:

- a document contributes once to a bucket if any value matches
- a multi-valued document may appear in multiple buckets

Bounds behave like this:

- lower bound is inclusive
- upper bound is exclusive

So `{ from: 400, to: 800 }` includes `400` and excludes `800`.

For `DateFieldIndex`, you can use ISO strings, numbers, or `Date` objects:

```ts
const freshness = publishedAtIndex.rangeAggregation([
  { key: "older", to: "2025-01-01T00:00:00.000Z" },
  { key: "recent", from: "2025-01-01T00:00:00.000Z" }
]);
```

## When to use it

- article length facets
- price bands
- recency buckets
- any UI where the user thinks in explicit ranges

## Tradeoffs

- Buckets are explicit. Querylight does not generate them automatically for you.

## Related articles

- [Histogram Aggregation](./histogram-aggregation.md)
- [Date Histogram Aggregation](./date-histogram-aggregation.md)
- [Numeric and Date Aggregations](./numeric-and-date-aggregations.md)
