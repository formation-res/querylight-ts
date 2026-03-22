---
id: date-histogram-aggregation
section: Aggregations
title: Date Histogram Aggregation
summary: Bucket date fields into fixed-width time intervals for timelines and recency views.
tags: [aggregation, date-histogram, date, time, analytics]
apis: [dateHistogram, DateFieldIndex]
level: advanced
order: 29
---

# Date Histogram Aggregation

`dateHistogram(intervalMs)` groups date fields into fixed-width time buckets.

## Basic usage

```ts
const publishedAtIndex = index.getFieldIndex("publishedAt") as DateFieldIndex;
const oneDay = 24 * 60 * 60 * 1000;
const buckets = publishedAtIndex.dateHistogram(oneDay);
```

Expected shape:

```ts
[
  { key: 1735776000000, keyAsString: "2025-01-02T00:00:00.000Z", docCount: 4 },
  { key: 1735862400000, keyAsString: "2025-01-03T00:00:00.000Z", docCount: 6 }
]
```

## How it works

Each bucket contains:

- `key`: bucket start in epoch milliseconds
- `keyAsString`: the same boundary as an ISO string
- `docCount`: matching documents in that interval

Like numeric histograms, this uses document-count semantics.

```ts
const recentBuckets = publishedAtIndex.dateHistogram(oneDay, new Set(["a", "b"]));
```

## When to use it

- daily or hourly activity charts
- publication timelines
- "recent vs older" exploration UIs

## Tradeoffs

- This is a fixed-interval histogram, not a calendar-aware one.
- There is no timezone-aware month/week bucketing yet.
- Interval must be a finite number greater than zero.

## Related articles

- [Histogram Aggregation](./histogram-aggregation.md)
- [Range Aggregation](./range-aggregation.md)
- [Numeric and Date Aggregations](./numeric-and-date-aggregations.md)
