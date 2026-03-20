---
id: aggregations
section: Discovery
title: Terms Aggregation and Significant Terms
summary: Build facets from the current result set and surface discriminative vocabulary.
tags: [aggregation, significant-terms, facets, discovery, analytics]
apis: [termsAggregation, getTopSignificantTerms, TermQuery]
level: querying
order: "07"
city: Rome
lat: 41.9028
lon: 12.4964
---

# Terms Aggregation and Significant Terms

Querylight exposes aggregation helpers directly on `TextFieldIndex`.

## Terms aggregation

Use `termsAggregation` to build facets such as tags, sections, or APIs.

```ts
const tagsIndex = index.getFieldIndex("tags") as TextFieldIndex;
const topTags = tagsIndex.termsAggregation(10, subsetIds);
```

## Significant terms

Use `getTopSignificantTerms` to compare the current subset with the full background corpus.

```ts
const bodyIndex = index.getFieldIndex("body") as TextFieldIndex;
const standoutTerms = bodyIndex.getTopSignificantTerms(8, subsetIds);
```

## Why this matters

- Facets help users narrow results quickly.
- Significant terms help users understand what makes the current slice distinctive.
- Both are useful in a documentation browser because they make exploration faster than scrolling.

## Learn more

- [Faceted search on Wikipedia](https://en.wikipedia.org/wiki/Faceted_search)
