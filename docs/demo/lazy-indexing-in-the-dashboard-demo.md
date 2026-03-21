---
id: lazy-indexing-dashboard-demo
section: Demo Internals
title: Lazy Indexing in the Dashboard Demo
summary: How the dashboard route delays index construction until a section is actually viewed.
tags: [demo, lazy-loading, indexing, dashboard, browser, echarts]
apis: [DocumentIndex, TextFieldIndex, NumericFieldIndex, DateFieldIndex, GeoFieldIndex, IntersectionObserver]
level: advanced
order: 30
---

# Lazy Indexing in the Dashboard Demo

The dashboard route does not build every dataset index immediately on page load.

Instead, it ships normalized raw records and only constructs the Querylight indexes for a section when that section scrolls into view.

That design exists for two reasons:

- it keeps the initial route lighter
- it demonstrates that Querylight TS can be applied incrementally

## Why the demo does this

The dashboard contains several different data domains:

- World Bank indicator rows
- earthquake event records
- weather telemetry rows

Each domain has its own index mapping and query logic.

If the page eagerly built everything up front, it would still work, but the demo would make a weaker architectural point.

The lazy approach shows that you can:

- ship raw records first
- build only what you need
- keep the rest dormant until interaction demands it

## High-level flow

The route creates an index registry and an `IntersectionObserver`.

When a section becomes visible:

1. the route checks whether that section is already initialized
2. if not, it builds the appropriate `DocumentIndex`
3. it wires the section controls
4. it renders the charts

After that, the initialized section keeps reusing the same in-memory index.

## Example shape

Conceptually the runtime does this:

```ts
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) {
      return;
    }
    initSection(entry.target.dataset.dashboardSection);
  });
});
```

Each initializer creates an index that matches the data domain:

- text fields for categories and exact filters
- numeric fields for metrics
- date fields for time windows
- geo fields where location is useful

## What is lazy and what is not

The demo still downloads the generated dashboard payload up front.

What is deferred is:

- index construction
- control wiring
- chart setup

That matters because those are the pieces that turn passive JSON into an interactive analytics surface.

## Trade-offs

Lazy indexing improves startup behavior, but it also means:

- the first reveal of a section does more work
- the runtime has more moving parts
- the code is slightly more complex than eager initialization

For the demo, that tradeoff is worth it because the lazy path is itself part of what the page is teaching.

## Related articles

- [From Raw API Payloads to Browser Dashboards](../guides/from-raw-api-payloads-to-browser-dashboards.md)
- [Build Interactive ECharts Dashboards from Plain JSON](../guides/building-echarts-dashboards-from-plain-json.md)
- [Ask the Docs End to End](./ask-the-docs-end-to-end.md)
