---
id: beyond-full-text-search
section: Overview
title: What Querylight TS Can Do Beyond Full-Text Search
summary: Querylight TS can power more than lexical retrieval, including faceting, aggregations, semantic retrieval, geo filtering, and lightweight dashboards.
tags: [overview, search, analytics, facets, geo, vector, dashboard]
apis: [DocumentIndex, NumericFieldIndex, DateFieldIndex, GeoFieldIndex, VectorFieldIndex, termsAggregation, histogram, dateHistogram]
level: foundation
order: 62
---

# What Querylight TS Can Do Beyond Full-Text Search

It is easy to look at Querylight TS and assume it is only a small browser full-text search library.

That would miss a large part of the design.

The library already supports several capability layers:

- lexical retrieval
- faceted filtering
- numeric and date aggregations
- significant terms
- vector search and rescoring
- geo indexing and geo queries
- serialized index state for build-time shipping

The new dashboard demo extends that story into lightweight local analytics.

## Search is still the center

The search use case is still real and important:

- docs search
- static site search
- app help centers
- small embedded retrieval tasks

But once your documents include structured fields, the same indexes can support more than ranked text matching.

## Examples of "beyond search" behavior

### Faceted discovery

Build sidebars and active filters from:

- `termsAggregation(...)`
- `rangeAggregation(...)`
- `histogram(...)`
- `dateHistogram(...)`

### Lightweight local dashboards

Use:

- `TermQuery`
- `TermsQuery`
- `RangeQuery`
- numeric/date field stats and buckets

to derive chart-ready subsets from raw records.

### Semantic retrieval

Use:

- `VectorFieldIndex`
- semantic embeddings
- reranking or nearest-neighbor search

for question answering or related-content experiences.

### Geo-aware filtering

Use:

- `GeoFieldIndex`
- `GeoPointQuery`
- `GeoPolygonQuery`

for location-based slices and map-adjacent interfaces.

## Why this matters

For small browser and local-first systems, it is useful when one toolkit can cover several adjacent needs instead of forcing an early split into:

- one library for search
- one library for analytics
- one library for geo
- one extra backend just to make the UI interactive

Querylight TS does not replace every specialized system. But it can cover a wider practical surface than "text in, ranked hits out".

## Related articles

- [What Querylight TS Covers](./what-querylight-ts-covers.md)
- [Using Querylight TS as a Local Analytics Engine](../guides/using-querylight-ts-as-a-local-analytics-engine.md)
- [Search Engine Techniques for Analytics UIs](./search-engine-techniques-for-analytics-uis.md)
- [Geo Indexing with Points and Polygons](../features/geo-indexing-with-points-and-polygons.md)
