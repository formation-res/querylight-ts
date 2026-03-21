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

Querylight TS is a toolkit, which means the most useful question is often "what pattern should I assemble for my use case?"

Here are a few practical recipes.

## Documentation search

Use:

- `title`, `summary`, and `body` fields
- metadata fields such as `section` and `tags`
- prebuilt serialized index state
- optional chunked vector search for question-style retrieval

This is the pattern used throughout the demo.

## Blog or article search

Use:

- title and body search
- tags and date-like metadata
- a combined field for broad recall
- highlighting for result snippets

If date ordering matters, keep sortable string representations available for filters or secondary sorting logic.

## Product or catalog search

Use:

- exact metadata fields for category, brand, and availability
- free-text fields for title and description
- facets for drill-down navigation
- autocomplete for product-name discovery

This is where field separation matters most.

## Related content

Use:

- lexical overlap from tags and title
- optional vector similarity for semantic relatedness
- RRF if you want to combine both

This works well for article recommendations and "read next" widgets.

## Location-aware search

Use:

- text fields for names and descriptions
- `GeoFieldIndex` for geographic constraints
- optional lexical plus geo fusion when both topic and location matter

## A reasonable default architecture

If you are unsure where to start:

1. model explicit metadata fields
2. add a combined catch-all field
3. prebuild and serialize the index
4. add facets or autocomplete only where needed
5. add vector features only after lexical search is already solid

That sequence keeps the system understandable while still leaving room for more advanced retrieval later.
