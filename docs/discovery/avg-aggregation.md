---
id: avg-aggregation
section: Discovery
title: Avg Aggregation
summary: Compute the arithmetic mean of indexed numeric or date values, optionally within the current result set.
tags: [aggregation, avg, numeric, date, analytics]
apis: [avg, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 25
---

# Avg Aggregation

`avg()` returns the arithmetic mean of the indexed values in a numeric or date field.

## Basic usage

```ts
const wordCountIndex = index.getFieldIndex("wordCount") as NumericFieldIndex;
const averageLength = wordCountIndex.avg();
```

## How it works

`avg()` is based on values, not documents.

That means a multi-valued document contributes all of its values to the average.

If there are no values, `avg()` returns `null`.

```ts
const averageLengthInSubset = wordCountIndex.avg(new Set(["a", "b"]));
```

## When to use it

- average article length
- average score or popularity
- average timestamp in a synthetic or event-style dataset

## Tradeoffs

- If you need the full summary, `stats()` is usually more convenient.

## Related articles

- [Value Count Aggregation](./value-count-aggregation.md)
- [Stats Aggregation](./stats-aggregation.md)
- [Numeric and Date Aggregations](./numeric-and-date-aggregations.md)
