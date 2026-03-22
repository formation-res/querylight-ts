---
id: max-aggregation
section: Aggregations
title: Max Aggregation
summary: Get the largest indexed numeric or date value, optionally restricted to the current result set.
tags: [aggregation, max, numeric, date, analytics]
apis: [max, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 23
---

# Max Aggregation

`max()` returns the largest indexed value in a numeric or date field.

## Basic usage

```ts
const wordCountIndex = index.getFieldIndex("wordCount") as NumericFieldIndex;
const longest = wordCountIndex.max();
```

## How it works

`max()` returns:

- the largest stored value when one exists
- `null` when the field or subset has no values

```ts
const longestInSubset = wordCountIndex.max(new Set(["a", "b"]));
```

## When to use it

- latest publication time
- most expensive product
- upper bound for range labels and charts

## Tradeoffs

- Like `min()`, date results are epoch milliseconds.

## Related articles

- [Min Aggregation](./min-aggregation.md)
- [Stats Aggregation](./stats-aggregation.md)
- [NumericFieldIndex and DateFieldIndex for Structured Features](../indexing/numeric-and-date-fields.md)
