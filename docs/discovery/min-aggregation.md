---
id: min-aggregation
section: Aggregations
title: Min Aggregation
summary: Get the smallest indexed numeric or date value, optionally restricted to the current result set.
tags: [aggregation, min, numeric, date, analytics]
apis: [min, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 22
---

# Min Aggregation

`min()` returns the smallest indexed value in a numeric or date field.

## Basic usage

```ts
const publishedAtIndex = index.getFieldIndex("publishedAt") as DateFieldIndex;
const earliest = publishedAtIndex.min();
```

For date fields, the return value is an epoch timestamp in milliseconds.

## How it works

`min()` scans the indexed numeric values and returns:

- the smallest value when at least one value exists
- `null` when the field or subset has no values

Subset example:

```ts
const earliestInSubset = publishedAtIndex.min(new Set(["a", "c"]));
```

## When to use it

- earliest publication time
- smallest price in the current slice
- lower bound for histogram or chart labels

## Tradeoffs

- Date results are numeric timestamps. Format them for display.

## Related articles

- [Max Aggregation](./max-aggregation.md)
- [Stats Aggregation](./stats-aggregation.md)
- [Numeric and Date Aggregations](./numeric-and-date-aggregations.md)
