---
id: histogram-aggregation
section: Aggregations
title: Histogram Aggregation
summary: Bucket numeric fields into regular fixed-width intervals for charts and sidebar facets.
tags: [aggregation, histogram, numeric, facets, analytics]
apis: [histogram, NumericFieldIndex]
level: advanced
order: 28
---

# Histogram Aggregation

`histogram(interval)` groups numeric values into regular fixed-width buckets.

## Basic usage

```ts
const priceIndex = index.getFieldIndex("price") as NumericFieldIndex;
const buckets = priceIndex.histogram(10);
```

Expected shape:

```ts
[
  { key: 0, docCount: 4 },
  { key: 10, docCount: 9 },
  { key: 20, docCount: 3 }
]
```

Each `key` is the start of the bucket.

## How it works

With an interval of `10`:

- values from `0` through `9.999...` land in bucket `0`
- values from `10` through `19.999...` land in bucket `10`

Buckets use document-count semantics, so a document contributes once per bucket even if multiple values fall inside the same bucket.

```ts
const subsetBuckets = priceIndex.histogram(10, new Set(["a", "b"]));
```

## When to use it

- price charts
- popularity distributions
- article length histograms

## Tradeoffs

- Only fixed-width intervals are supported.
- Interval must be a finite number greater than zero.

## Related articles

- [Range Aggregation](./range-aggregation.md)
- [Date Histogram Aggregation](./date-histogram-aggregation.md)
- [NumericFieldIndex and DateFieldIndex for Structured Features](../indexing/numeric-and-date-fields.md)
