---
id: how-to-build-faceted-navigation
section: Guides
title: How To Build Faceted Navigation
summary: Use text, numeric, and date aggregations over the current hit set to drive filters, counts, and exploratory navigation through the JSON DSL.
tags: [facets, aggregations, filters, navigation, significant-terms, histogram]
apis: [searchJsonDsl, DocumentIndex]
level: querying
order: 20
---

# How To Build Faceted Navigation

Faceted navigation turns search into exploration. Instead of only showing a ranked list, you also expose structured ways to narrow the result set.

Querylight TS already has the core ingredients:

- a main query
- metadata fields such as `tags` or `section`
- top-level `aggs`
- filter clauses such as `term` and `range`

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
2. attach the aggregations you want at the top level
3. render counts and buckets from the response

That makes facet counts contextual instead of global.

## Typical fields for facets

- tags
- section
- level
- category
- language
- numeric values such as price, popularity, or word count
- date values such as published-at or updated-at

These are useful because users recognize them as navigation controls.

## Numeric and date facets work well too

Facets do not have to be text-only.

If you index fields with `NumericFieldIndex` or `DateFieldIndex`, you can derive:

- range chips such as `Under 400 words`, `400-800`, `800+`
- histogram bars for prices or scores
- date buckets such as "published this week" or "older content"
- summary metrics such as average document length

That is useful when your users think in ranges instead of labels.

## Example pattern

```ts
const response = await searchJsonDsl({
  index,
  request: {
    query,
    aggs: {
      tags: { terms: { field: "tags", size: 12 } },
      lengths: {
        range: {
          field: "wordCount",
          ranges: [
            { key: "short", to: 400 },
            { key: "medium", from: 400, to: 800 },
            { key: "long", from: 800 }
          ]
        }
      },
      lengthStats: { stats: { field: "wordCount" } }
    }
  }
});
```

That gives you:

- human-readable text facets
- numeric range buckets
- a small summary for the current slice

## Combine filters with BoolQuery

When a user clicks a facet value, add it as a filter clause rather than a ranking clause.

That keeps the search logic clear:

- free-text clauses decide relevance
- filter clauses decide eligibility

For text facets, that usually means `term`.

For numeric or date ranges, use `range`.

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
- optional histogram or range groups for numeric/date fields
- active filters rendered as removable chips

This gives users a clear sense of where they are in the corpus.

## Practical advice

- keep facet labels stable and human-readable
- use filters for hard constraints
- recompute counts from the current hit set
- use numeric/date buckets when labels alone are not enough
- avoid too many low-value facet groups

Facets are most useful when they mirror real concepts in your content model.
