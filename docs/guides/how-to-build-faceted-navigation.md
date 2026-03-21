---
id: how-to-build-faceted-navigation
section: Guides
title: How To Build Faceted Navigation
summary: Use aggregations over the current hit set to drive filters, counts, and exploratory navigation.
tags: [facets, aggregations, filters, navigation, significant-terms]
apis: [termsAggregation, getTopSignificantTerms, BoolQuery, TermQuery, DocumentIndex]
level: querying
order: 20
---

# How To Build Faceted Navigation

Faceted navigation turns search into exploration. Instead of only showing a ranked list, you also expose structured ways to narrow the result set.

Querylight TS already has the core ingredients:

- a main query
- metadata fields such as `tags` or `section`
- aggregation helpers on field indexes

## Index filterable metadata separately

```ts
index.index({
  id: "docs-1",
  fields: {
    title: ["Highlighting with Querylight TS"],
    body: ["Highlighting is a post-retrieval step."],
    section: ["Operations"],
    tags: ["highlighting", "search", "snippets"]
  }
});
```

Facet fields should be explicit. Do not expect to build stable facet counts from one giant body field.

## Build counts from the current result set

The usual flow is:

1. run a search query
2. collect the matching document ids
3. aggregate over a metadata field for those ids

That makes facet counts contextual instead of global.

## Typical fields for facets

- tags
- section
- level
- category
- language

These are useful because users recognize them as navigation controls.

## Combine filters with BoolQuery

When a user clicks a facet value, add it as a filter clause rather than a ranking clause.

That keeps the search logic clear:

- free-text clauses decide relevance
- filter clauses decide eligibility

## Significant terms are useful for discovery

Counts tell users what is common in the current slice. Significant terms tell them what is unusually characteristic.

That is helpful for:

- "related topics" sidebars
- suggested follow-up filters
- vocabulary hints in documentation search

## UI pattern that works well

- query box on top
- result list in the main pane
- facet counts in a sidebar
- active filters rendered as removable chips

This gives users a clear sense of where they are in the corpus.

## Practical advice

- keep facet labels stable and human-readable
- use filters for hard constraints
- recompute counts from the current hit set
- avoid too many low-value facet groups

Facets are most useful when they mirror real concepts in your content model.
