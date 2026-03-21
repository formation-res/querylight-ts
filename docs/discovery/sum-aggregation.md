---
id: sum-aggregation
section: Discovery
title: Sum Aggregation
summary: Add up all indexed numeric or date values in a field, optionally within a filtered subset.
tags: [aggregation, sum, numeric, date, analytics]
apis: [sum, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 24
---

# Sum Aggregation

`sum()` adds all indexed values in a numeric or date field.

## Basic usage

```ts
const popularityIndex = index.getFieldIndex("popularity") as NumericFieldIndex;
const totalPopularity = popularityIndex.sum();
```

## How it works

`sum()` aggregates values, not documents.

If a document has multiple values, each value contributes to the total.

```ts
const totalForSubset = popularityIndex.sum(new Set(["a", "b"]));
```

## When to use it

- total score-like metadata
- cumulative counters
- building your own derived metrics from `sum()` and `valueCount()`

## Tradeoffs

- This is usually more useful for numeric fields than for dates.
- Multi-valued documents contribute multiple times.

## Related articles

- [Avg Aggregation](./avg-aggregation.md)
- [Stats Aggregation](./stats-aggregation.md)
- [Numeric and Date Aggregations](./numeric-and-date-aggregations.md)
