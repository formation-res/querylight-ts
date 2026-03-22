---
id: value-count-aggregation
section: Aggregations
title: Value Count Aggregation
summary: Count how many numeric or date values are indexed, optionally within the current result set.
tags: [aggregation, value-count, numeric, date, analytics]
apis: [valueCount, NumericFieldIndex, DateFieldIndex]
level: advanced
order: 21
---

# Value Count Aggregation

`valueCount()` returns the number of indexed values in a numeric or date field.

Use it when you want to know how many values contributed to a summary or chart.

## Basic usage

```ts
const priceIndex = index.getFieldIndex("price") as NumericFieldIndex;
const count = priceIndex.valueCount();
```

If one document stores multiple values, all of them are counted.

## How it works

`valueCount()` counts values, not documents.

That means:

- one document with one value contributes `1`
- one document with three values contributes `3`
- invalid values that were skipped during indexing do not contribute

You can also scope it to a subset:

```ts
const subsetIds = new Set(["a", "b"]);
const count = priceIndex.valueCount(subsetIds);
```

## When to use it

- show how many timestamps were indexed
- explain the denominator behind `avg()`
- sanity-check sparse numeric/date fields

## Tradeoffs

- This is not a unique-document count.
- This is not cardinality.

## Related articles

- [Min Aggregation](./min-aggregation.md)
- [Avg Aggregation](./avg-aggregation.md)
- [NumericFieldIndex and DateFieldIndex for Structured Features](../indexing/numeric-and-date-fields.md)
