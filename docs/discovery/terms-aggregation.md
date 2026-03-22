---
id: terms-aggregation
section: Aggregations
title: Terms Aggregation
summary: Build document-count facets from text fields over the full corpus or the current hit set.
tags: [aggregation, facets, discovery, analytics, terms]
apis: [termsAggregation, TermQuery, TextFieldIndex]
level: querying
order: 10
---

# Terms Aggregation

Querylight exposes text-oriented aggregation helpers directly on `TextFieldIndex`.

If you have used e-commerce or documentation search before, you have already seen aggregations. They are the counts in sidebars such as:

- `Tags: vector (3), highlighting (2), ranking (2)`
- `Section: Overview (4), Advanced (3)`

In Querylight TS, aggregations are not a separate server feature. They are computed directly from field indexes, optionally restricted to a subset of matching document ids.

## Basic usage

Use `termsAggregation` to build facets such as tags, sections, or APIs.

```ts
import { DocumentIndex, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  tags: new TextFieldIndex()
});

index.index({ id: "a", fields: { tags: ["vector", "browser"] } });
index.index({ id: "b", fields: { tags: ["vector", "aggregation"] } });
index.index({ id: "c", fields: { tags: ["aggregation"] } });

const tagsIndex = index.getFieldIndex("tags") as TextFieldIndex;
const topTags = tagsIndex.termsAggregation(10);
```

Expected result:

```ts
{
  vector: 2,
  aggregation: 2,
  browser: 1
}
```

If you only want facets for the current result set, pass the matching ids:

```ts
const subsetIds = new Set(["a", "b"]);
const subsetTags = tagsIndex.termsAggregation(10, subsetIds);
```

Expected result:

```ts
{
  vector: 2,
  browser: 1,
  aggregation: 1
}
```

`termsAggregation` counts documents, not raw term occurrences.

That means if the same term appears multiple times inside one document, that document still contributes only once to the bucket. This is usually what you want for facet counts.

## How it works

`termsAggregation` is a document-count aggregation.

- A document contributes at most once to a given bucket.
- Multi-valued fields can contribute to multiple buckets.
- Passing a subset id set makes the buckets reflect the current result slice instead of the full corpus.

This makes it a good fit for navigational facets and filter sidebars.

## When to use it

Use `termsAggregation` when users need:

- category counts
- tag sidebars
- section or author facets
- filter counts that stay aligned with the current result set

It works best on stable, keyword-like values rather than long prose.

## Limitations

- Counts are by document, not raw token frequency.
- High-cardinality text fields can produce noisy facets.
- Free-form prose often works better with significant terms than with facet buckets.

## How the demo uses this

The right sidebar in the demo runs `termsAggregation` over the currently selected result ids. That means the visible tags and counts update as soon as the query, filters, or ranking mode changes.

## Related articles

- [Significant Terms Aggregation](./significant-terms-aggregation.md)
- [How To Build Faceted Navigation](../guides/how-to-build-faceted-navigation.md)
- [How the Aggregations Sidebar Works](../demo/tag-aggregations-sidebar.md)
- [Faceted search on Wikipedia](https://en.wikipedia.org/wiki/Faceted_search)
