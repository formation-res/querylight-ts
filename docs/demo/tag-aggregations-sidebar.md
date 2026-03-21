---
id: tag-aggregations-sidebar
section: Demo Internals
title: How the Tag Aggregations Sidebar Works
summary: How the demo calculates live tag counts and significant terms for the right-hand sidebar.
tags: [demo, aggregations, facets, sidebar, significant-terms]
apis: [termsAggregation, getTopSignificantTerms, BoolQuery, TermQuery]
level: advanced
order: 20
---

# How the Tag Aggregations Sidebar Works

The right sidebar in the demo is a live faceting panel. Its job is to answer questions like:

- Which tags appear in the current results?
- Which sections are represented?
- Which APIs are most common?
- Which terms are unusually characteristic of this result set?

## The core idea

The sidebar is not driven by a separate database. It is driven by the same `DocumentIndex` search results that power the result list.

The flow is:

1. Run the current query.
2. Collect the matched document ids.
3. Run aggregations on fields such as `tags`, `section`, and `api` using only those ids.
4. Render the counts as clickable chips.

That means the sidebar always reflects the current query state.

## Where this happens in the demo

Relevant source:

- [apps/demo/src/main.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/main.ts)
- [apps/demo/build/demo-data.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/build/demo-data.ts)

The important pieces are:

- `buildFacetFilterQueries(...)`: turns current UI filter state into `TermQuery` filters
- `searchForState(...)`: runs the search, computes selected ids, and derives facets
- `renderFacets(...)`: renders the sidebar groups and active filter chips

## Indexing tags so aggregations stay clean

The demo indexes tags, sections, and API names with a keyword-style analyzer instead of full text analysis.

That matters because facet values should usually stay intact:

- `vector-search` should remain one tag value
- `BM25` should remain one API value
- `Advanced` should remain one level value

This setup is defined in the demo data/index creation code, where metadata fields are added as dedicated index fields.

## Example

Imagine three docs:

```ts
[
  { id: "a", tags: ["vector", "demo"] },
  { id: "b", tags: ["vector", "aggregations"] },
  { id: "c", tags: ["highlighting"] }
]
```

If the current search only matches `a` and `b`, the sidebar tag aggregation is effectively:

```ts
const subsetIds = new Set(["a", "b"]);
const tagFacets = tagsIndex.termsAggregation(12, subsetIds);
```

Expected result:

```ts
{
  vector: 2,
  demo: 1,
  aggregations: 1
}
```

Doc `c` does not contribute because it is not part of the active result set.

## Why significant terms are also shown

Tag counts answer "what is here?" Significant terms answer "what is unusually prominent here?"

The demo computes significant terms from the `body` field for the current result ids. This is why the sidebar can suggest topic words that are not explicit tags but still characterize the current slice of docs.

That is useful when:

- users do not know the official tag vocabulary
- you want discovery hints beyond curated metadata
- the result set is narrow enough to have a recognizable topic

## What happens when filters are clicked

Clicking a tag chip does not rerun a special facet query. It updates the search state and runs the normal search flow again with an added `TermQuery("tags", value)` filter.

After that:

- the result list changes
- the selected document ids change
- the sidebar counts are recomputed from the new subset

So the sidebar is both:

- an explanation of the current result set
- a control surface for narrowing it further

## Why this is a good fit for docs

Documentation search is often exploratory. Users do not always arrive with the exact page title or exact API name.

The sidebar helps because it turns a flat result list into a navigable slice of the corpus:

- tags reveal topic clusters
- sections reveal where the results live
- APIs reveal concrete entry points
- significant terms reveal vocabulary worth trying next

That is a big improvement over just showing ten blue links.
