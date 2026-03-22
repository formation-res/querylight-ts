---
id: stats-aggregation
section: Aggregations
title: Stats Aggregation
summary: Get count, min, max, sum, and average from a numeric or date field in one call.
tags: [aggregation, stats, numeric, date, analytics]
apis: [stats, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 26
---

# Stats Aggregation

`stats()` returns a compact metric summary for a numeric or date field.

## Basic usage

```ts
const wordCountIndex = index.getFieldIndex("wordCount") as NumericFieldIndex;
const summary = wordCountIndex.stats();
```

Expected shape:

```ts
{
  count: 3,
  min: 250,
  max: 1400,
  sum: 2250,
  avg: 750
}
```

## How it works

`stats()` combines:

- `valueCount()`
- `min()`
- `max()`
- `sum()`
- `avg()`

into one result object.

If no values are available, it returns:

```ts
{
  count: 0,
  min: null,
  max: null,
  sum: 0,
  avg: null
}
```

## When to use it

- sidebar summaries
- chart headers
- quick diagnostics while exploring a filtered subset

## Tradeoffs

- If you only need one metric, a dedicated helper is simpler.

## Related articles

- [Avg Aggregation](./avg-aggregation.md)
- [Range Aggregation](./range-aggregation.md)
- [Numeric and Date Aggregations](./numeric-and-date-aggregations.md)
