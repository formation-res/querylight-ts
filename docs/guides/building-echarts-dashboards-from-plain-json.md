---
id: echarts-dashboards-from-plain-json
section: Guides
title: Build Interactive ECharts Dashboards from Plain JSON
summary: Use Querylight TS to turn plain JSON records into the filtered series and buckets that Apache ECharts expects.
tags: [echarts, dashboard, browser, json, charts, aggregations]
apis: [DocumentIndex, BoolQuery, TermQuery, TermsQuery, RangeQuery, NumericFieldIndex, DateFieldIndex, termsAggregation]
level: querying
order: 32
---

# Build Interactive ECharts Dashboards from Plain JSON

The dashboard demo uses [Apache ECharts](https://echarts.apache.org/) for the visualizations and Querylight TS for the data slicing.

That separation is deliberate:

- Querylight TS defines the subset and derives aggregates
- Apache ECharts renders the result

## Think in two layers

Do not try to make the charting library solve filtering and aggregation by itself.

Instead:

1. filter raw records with Querylight TS
2. derive chart-ready arrays
3. pass those arrays to ECharts

That keeps the chart code simple.

## Example: bar chart from a terms aggregation

```ts
const subset = new Set(
  index.search(new BoolQuery([], [], filters)).map(([id]) => id)
);

const categories = placeCategoryField.termsAggregation(8, subset);

const option = {
  xAxis: { type: "category", data: Object.keys(categories) },
  yAxis: { type: "value" },
  series: [
    {
      type: "bar",
      data: Object.values(categories)
    }
  ]
};
```

That is a very small bridge from Querylight output to ECharts input.

## Example: line chart from a filtered series

When using a category x-axis, make sure the series values align with the category list.

```ts
const years = [2019, 2020, 2021, 2022, 2023, 2024];

const series = activeCountries.map((country) => ({
  name: country,
  type: "line",
  data: years.map((year) =>
    records.find((record) => record.countryName === country && record.year === year)?.value ?? null
  )
}));
```

That is the shape the dashboard demo now uses for its World Bank chart.

## Example: pie chart from an active slice

```ts
const pieData = Object.entries(weatherCodes).map(([name, value]) => ({
  name,
  value
}));
```

Then ECharts can render:

```ts
{
  series: [
    {
      type: "pie",
      radius: ["30%", "72%"],
      data: pieData
    }
  ]
}
```

## Example: time buckets

```ts
const dayMs = 24 * 60 * 60 * 1000;
const buckets = observedAtField.dateHistogram(dayMs, subset);
```

That translates naturally into:

- x-axis labels from `bucket.keyAsString`
- y-axis values from `bucket.docCount`

## Why this combination works well

Apache ECharts is excellent at visual composition and interaction.

Querylight TS is useful for turning local raw records into:

- subsets
- counts
- metrics
- buckets
- categorical summaries

Together they cover both halves of the problem.

## Related articles

- [From Raw API Payloads to Browser Dashboards](./from-raw-api-payloads-to-browser-dashboards.md)
- [Using Querylight TS as a Local Analytics Engine](./using-querylight-ts-as-a-local-analytics-engine.md)
- [Lazy Indexing in the Dashboard Demo](../demo/lazy-indexing-in-the-dashboard-demo.md)
