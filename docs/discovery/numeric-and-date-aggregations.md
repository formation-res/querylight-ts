---
id: numeric-date-aggregations
section: Aggregations
title: Numeric and Date Aggregations
summary: A map of the numeric and date aggregation helpers available on NumericFieldIndex and DateFieldIndex.
tags: [aggregation, numeric, date, histogram, range, analytics]
apis: [NumericFieldIndex, DateFieldIndex, valueCount, min, max, sum, avg, stats, rangeAggregation, histogram, dateHistogram]
level: advanced
order: 20
---

# Numeric and Date Aggregations

`NumericFieldIndex` and `DateFieldIndex` expose a small aggregation surface for metric summaries and bucketed navigation.

The available helpers are:

- `valueCount()`
- `min()`
- `max()`
- `sum()`
- `avg()`
- `stats()`
- `rangeAggregation(...)`
- `histogram(...)`
- `dateHistogram(...)`

They run directly on the in-memory field data and can optionally be restricted to a subset of matching document ids.

## Feature articles

- [Value Count Aggregation](./value-count-aggregation.md)
- [Min Aggregation](./min-aggregation.md)
- [Max Aggregation](./max-aggregation.md)
- [Sum Aggregation](./sum-aggregation.md)
- [Avg Aggregation](./avg-aggregation.md)
- [Stats Aggregation](./stats-aggregation.md)
- [Range Aggregation](./range-aggregation.md)
- [Histogram Aggregation](./histogram-aggregation.md)
- [Date Histogram Aggregation](./date-histogram-aggregation.md)

## Shared behavior

All of these helpers support optional subset ids so the aggregation can reflect the current result set instead of the full corpus.

Metric-style aggregations operate on values.

Bucket-style aggregations operate on document counts:

- a document contributes once per matching bucket
- a multi-valued document may contribute to multiple buckets

That is usually the right default for facets and sidebars.

## Related articles

- [Terms Aggregation and Significant Terms](./terms-aggregation-and-significant-terms.md)
- [NumericFieldIndex and DateFieldIndex for Structured Features](../indexing/numeric-and-date-fields.md)
- [How To Build Faceted Navigation](../guides/how-to-build-faceted-navigation.md)
