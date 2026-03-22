---
id: local-analytics-engine
section: Guides
title: Using Querylight TS as a Local Analytics Engine
summary: How to use Querylight TS filtering and aggregation primitives for browser-side analytics over plain JSON records.
tags: [analytics, aggregations, browser, json, local-first, dashboard]
apis: [DocumentIndex, TextFieldIndex, NumericFieldIndex, DateFieldIndex, BoolQuery, TermQuery, TermsQuery, RangeQuery, termsAggregation, stats, histogram, dateHistogram]
level: querying
order: 31
---

# Using Querylight TS as a Local Analytics Engine

Querylight TS exposes search-style primitives, but many of those primitives are also useful for analytics.

The most important shift is this:

- search asks "which documents match?"
- analytics asks "what can I learn from the matching documents?"

The matching step is still important. It defines the slice. After that, the aggregation APIs do the rest.

## The minimum ingredients

For a local analytics flow you usually need:

- a `DocumentIndex`
- explicit text fields for exact-match filters
- numeric and date fields for metrics and time windows
- a way to turn hits into a `Set<string>` of matching ids

```ts
const subset = new Set(
  index.search(new BoolQuery([], [], [
    new TermsQuery("city", ["Berlin", "Nairobi"]),
    new RangeQuery("observedAt", {
      gte: "2024-06-01T00:00:00.000Z",
      lte: "2024-06-10T23:59:59.000Z"
    })
  ])).map(([id]) => id)
);
```

That `subset` is the local analytics window.

## Useful aggregations

Once you have a subset, the field indexes can answer several different questions.

### Category counts

```ts
const weatherCodes = weatherCodeField.termsAggregation(8, subset);
```

Use this for:

- pie charts
- ranked category bars
- filter counts

### Numeric summaries

```ts
const stats = temperatureField.stats(subset);
```

Use this for:

- min / max / average cards
- KPI summaries
- quick context above a chart

### Numeric distributions

```ts
const buckets = temperatureField.histogram(2, subset);
```

Use this for:

- histograms
- rough distributions
- range summaries

### Time distributions

```ts
const daily = observedAtField.dateHistogram(24 * 60 * 60 * 1000, subset);
```

Use this for:

- activity over time
- daily counts
- fixed-interval trend views

### Significant terms

```ts
const interesting = textField.significantTermsAggregation(6, subset);
```

Use this for:

- "what stands out in this slice?"
- contextual hints
- exploratory labels near a chart

## Why this differs from a normal charting stack

Charting libraries render data well, but they do not tell you how to derive the data from raw records.

Querylight TS fills that gap by giving you:

- exact-match filters
- numeric/date filtering
- efficient subset-based aggregation helpers
- one in-memory representation that can support both search and analytics

That makes it useful when your data source is "an API that returns JSON rows" rather than "a service that already gives me every chart endpoint I need".

## Practical limits

This pattern is strongest when:

- the dataset is modest
- the documents are already local
- you need interactive filtering
- you want to keep deployment simple

It is not a replacement for a warehouse or OLAP engine. It is a useful middle ground between:

- no structured exploration at all
- a much larger analytics stack

## Related articles

- [From Raw API Payloads to Browser Dashboards](./from-raw-api-payloads-to-browser-dashboards.md)
- [Build Interactive ECharts Dashboards from Plain JSON](./building-echarts-dashboards-from-plain-json.md)
- [Terms Aggregation](../discovery/terms-aggregation.md)
- [Histogram Aggregation](../discovery/histogram-aggregation.md)
- [Date Histogram Aggregation](../discovery/date-histogram-aggregation.md)
- [Significant Terms Aggregation](../discovery/significant-terms-aggregation.md)
