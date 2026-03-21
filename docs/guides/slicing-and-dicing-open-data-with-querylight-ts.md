---
id: slicing-and-dicing-open-data
section: Guides
title: Slicing and Dicing Open Data with Querylight TS
summary: Use small open-data snapshots to prototype interactive analytics in the browser with Querylight TS.
tags: [open-data, dashboard, browser, api, aggregation, prototype]
apis: [DocumentIndex, TermQuery, TermsQuery, RangeQuery, NumericFieldIndex, DateFieldIndex, GeoFieldIndex]
level: querying
order: 33
---

# Slicing and Dicing Open Data with Querylight TS

Open data is useful for demos because it behaves like real product data in one important way: it usually arrives as raw records.

That makes it a good fit for Querylight TS.

The dashboard demo uses three toy snapshots:

- World Bank indicators
- USGS earthquakes
- Open-Meteo weather history

These are not meant to support serious analysis. They are there to show how to go from raw records to interactive exploration.

## Why open data works well for this pattern

- the payloads are public
- the data shapes are realistic
- the rows have enough structure for filtering
- you can tell a coherent story with small samples

## A useful workflow

1. Choose one or two representative endpoints.
2. Download a small snapshot at build time.
3. Normalize the fields you care about.
4. Keep the raw record shape recognizable.
5. Index exact-match, numeric, date, and geo fields as needed.
6. Drive charts from subset aggregations.

That gives you a realistic prototype without a large backend.

## Good questions to ask while exploring

- which dimensions make sense as filters?
- which metrics deserve summaries?
- which distributions are worth charting?
- what vocabulary becomes significant in a slice?
- what is the minimum local document shape that still feels expressive?

Those are product questions as much as they are technical ones.

## Keep the disclaimers honest

If you use open data in a demo:

- state clearly that the datasets are toy snapshots
- attribute the source visibly
- avoid claiming analytical correctness you did not validate
- treat the visualizations as examples of capability, not conclusions

That is the stance the dashboard demo now takes.

## Related articles

- [From Raw API Payloads to Browser Dashboards](./from-raw-api-payloads-to-browser-dashboards.md)
- [Why Local-First Data Exploration Helps API Prototyping](../overview/why-local-first-data-exploration-helps-api-prototyping.md)
- [Lazy Indexing in the Dashboard Demo](../demo/lazy-indexing-in-the-dashboard-demo.md)
