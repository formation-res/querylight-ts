---
id: real-world-recipes
section: Guides
title: Real-World Recipes
summary: Practical patterns for docs search, blog search, product filtering, related content, and lightweight semantic retrieval.
tags: [recipes, docs-search, facets, related-content, vector]
apis: [createSimpleTextSearchIndex, reciprocalRankFusion, termsAggregation, VectorFieldIndex, GeoFieldIndex]
level: foundation
order: 30
---

# Real-World Recipes

Querylight TS is a toolkit, so the main question is which field layout, query pattern, and deployment flow match your use case.

These recipes give you a starting shape for each.

## Documentation search

Use:

- `title`, `summary`, and `body` fields
- metadata fields such as `section` and `tags`
- prebuilt serialized index state
- optional chunked vector search for question-style retrieval

This is the pattern used throughout the demo.

Typical query shape:

- `MatchQuery` or `MultiMatchQuery` over `title`, `summary`, and `body`
- `BoolQuery.filter` for `section`, `tags`, or product/version metadata
- optional chunk-level vector retrieval for question-style search

## Blog or article search

Use:

- title and body search
- tags and date-like metadata
- a combined field for broad recall
- highlighting for result snippets

If date ordering matters, keep sortable string representations available for filters or secondary sorting logic.

Typical query shape:

- `MatchQuery` over `title`
- broader `MatchQuery` or combined-field search over `body`
- optional `BoolQuery.filter` on tags, authors, or date ranges

## Product or catalog search

Use:

- exact metadata fields for category, brand, and availability
- free-text fields for title and description
- facets for drill-down navigation
- autocomplete for product-name discovery

This is where field separation matters most.

Typical query shape:

- lexical query over `title` and `description`
- exact filters for category, brand, availability, and price ranges
- terms or range aggregations for the current result set

## Related content

Use:

- lexical overlap from tags and title
- optional vector similarity for semantic relatedness
- RRF if you want to combine both

This works well for article recommendations and "read next" widgets.

Typical query shape:

- start with shared tags, series, or categories as a lexical baseline
- add vector similarity when topical overlap is not enough
- use RRF when both signals add value

## Location-aware search

Use:

- text fields for names and descriptions
- `GeoFieldIndex` for geographic constraints
- optional lexical plus geo fusion when both topic and location matter

Typical query shape:

- lexical match on name or description
- `GeoPointQuery` or `GeoPolygonQuery` inside a `BoolQuery.filter`
- optional secondary ranking logic for distance or topical relevance

## A reasonable default architecture

If you are unsure where to start:

1. model explicit metadata fields
2. add a combined catch-all field
3. prebuild and serialize the index
4. add facets or autocomplete only where needed
5. add vector features only after lexical search is already solid

That sequence keeps the system understandable, keeps the first version shippable, and leaves room for more advanced retrieval later.
