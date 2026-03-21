---
id: raw-api-payloads-to-browser-dashboards
section: Guides
title: From Raw API Payloads to Browser Dashboards
summary: A practical pattern for turning raw API responses into local-first dashboard interactions with Querylight TS.
tags: [dashboard, api, browser, aggregations, local-first, echarts]
apis: [DocumentIndex, TextFieldIndex, NumericFieldIndex, DateFieldIndex, GeoFieldIndex, BoolQuery, TermQuery, TermsQuery, RangeQuery]
level: querying
order: 30
---

# From Raw API Payloads to Browser Dashboards

The new dashboard demo exists to make one point clear: Querylight TS is not just for search boxes.

If an API gives you rows of JSON instead of pre-aggregated charts, you can still build a usable analytics surface in the browser:

1. download or collect raw records
2. normalize them into a stable local shape
3. index the fields you want to filter and aggregate
4. derive subsets with queries
5. turn those subsets into chart series

That is the pattern used in the demo dashboard.

## Why this pattern is useful

Many APIs return data in one of these shapes:

- events
- measurements
- time-series rows
- records with tags, categories, and timestamps

That is enough for exploration, but not enough for a ready-made dashboard. Normally you would solve that with:

- a backend analytics service
- a warehouse
- SQL transformation jobs
- custom aggregation endpoints

For small datasets, prototypes, internal tools, and static demos, that can be overkill.

## A good document shape for analytics

The core idea is to treat each API row as a document and index the parts you want to slice on.

```ts
const index = new DocumentIndex({
  country: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
  indicatorId: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
  year: new NumericFieldIndex(),
  value: new NumericFieldIndex()
});

index.index({
  id: "usa-pop-2024",
  fields: {
    country: ["United States"],
    indicatorId: ["SP.POP.TOTL"],
    year: ["2024"],
    value: ["340110988"]
  }
});
```

That is not very different from indexing documents for search. The difference is what you do with the matching ids afterward.

## Use queries to define a subset

In the dashboard demo, charts start with a filtered subset:

```ts
const filters = [
  new TermQuery("indicatorId", "SP.POP.TOTL"),
  new TermsQuery("country", ["United States", "Germany", "Japan"]),
  new RangeQuery("year", { gte: "2018", lte: "2024" })
];

const subset = new Set(
  index.search(new BoolQuery([], [], filters)).map(([id]) => id)
);
```

Once you have `subset`, you can treat it as the current slice of the data.

## Build chart inputs from the slice

The charting library does not need to know anything about Querylight TS.

It only needs arrays of numbers, labels, and series data.

For example:

- `termsAggregation(...)` gives you category counts
- `stats(...)` gives you summary metrics
- `histogram(...)` gives you numeric buckets
- `dateHistogram(...)` gives you time buckets
- `getTopSignificantTerms(...)` gives you characteristic vocabulary for a slice

That is enough to power:

- bar charts
- pies
- histograms
- time series
- heatmaps
- scatter plots

## What the dashboard demo intentionally does not do

The demo is deliberately small in scope.

- The datasets are toy snapshots.
- The chart logic is illustrative rather than authoritative.
- The category heuristics are simple and may contain bugs.
- The goal is to show the pattern, not to ship a production BI stack.

That is an acceptable tradeoff for a docs demo because the architectural idea is the real subject.

## When this approach is a good fit

- static dashboards bundled with a browser app
- internal tools over modest datasets
- API exploration and prototyping
- educational demos
- local-first tools where shipping raw records is acceptable

It is less suitable when:

- the dataset is too large for browser memory
- you need complex joins
- you need strict reporting guarantees
- the query cost belongs on a backend

## Related articles

- [Using Querylight TS as a Local Analytics Engine](./using-querylight-ts-as-a-local-analytics-engine.md)
- [Build Interactive ECharts Dashboards from Plain JSON](./building-echarts-dashboards-from-plain-json.md)
- [How To Build Faceted Navigation](./how-to-build-faceted-navigation.md)
- [Lazy Indexing in the Dashboard Demo](../demo/lazy-indexing-in-the-dashboard-demo.md)
