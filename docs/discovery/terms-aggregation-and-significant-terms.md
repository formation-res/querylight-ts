---
id: aggregations
section: Discovery
title: Terms Aggregation and Significant Terms
summary: Build term facets from the current result set and surface discriminative vocabulary.
tags: [aggregation, significant-terms, facets, discovery, analytics, terms]
apis: [termsAggregation, getTopSignificantTerms, TermQuery, TextFieldIndex]
level: querying
order: 10
---

# Terms Aggregation and Significant Terms

Querylight exposes text-oriented aggregation helpers directly on `TextFieldIndex`.

If you have used e-commerce or documentation search before, you have already seen aggregations. They are the counts in sidebars such as:

- `Tags: vector (3), highlighting (2), ranking (2)`
- `Section: Overview (4), Advanced (3)`

In Querylight TS, aggregations are not a separate server feature. They are computed directly from field indexes, optionally restricted to a subset of matching document ids.

This article focuses on text-oriented discovery:

- term counts for facets
- significant terms for "what stands out here?"

If you specifically want metadata facets over documentation fields such as `section` and `tags`, see [Section and Tag Aggregations](./section-and-tag-aggregations.md).

For numeric/date buckets and metric summaries, see [Numeric and Date Aggregations](./numeric-and-date-aggregations.md).

## Terms aggregation

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

## Significant terms

Use `getTopSignificantTerms` to compare the current subset with the full background corpus.

```ts
import { DocumentIndex, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  body: new TextFieldIndex()
});

index.index({ id: "a", fields: { body: ["vector search embeddings semantic retrieval"] } });
index.index({ id: "b", fields: { body: ["vector search browser retrieval"] } });
index.index({ id: "c", fields: { body: ["range filters lexical matching"] } });

const bodyIndex = index.getFieldIndex("body") as TextFieldIndex;
const subsetIds = new Set(["a", "b"]);
const standoutTerms = bodyIndex.getTopSignificantTerms(8, subsetIds);
```

Expected shape:

```ts
{
  vector: [highScore, subsetDocCount, backgroundDocCount],
  retrieval: [highScore, subsetDocCount, backgroundDocCount],
  embeddings: [highScore, subsetDocCount, backgroundDocCount]
}
```

The exact score depends on term frequencies, but the main idea is stable: terms that are unusually common in the subset rise to the top.

Unlike `termsAggregation`, significant terms are not intended to produce stable filter counts. They are better used as:

- query suggestions
- sidebar hints
- exploratory vocabulary prompts

## Why this matters

- Facets help users narrow results quickly.
- Significant terms help users understand what makes the current slice distinctive.
- Both are useful in a documentation browser because they make exploration faster than scrolling.

## How the demo uses this

The right sidebar in the demo runs aggregations over the currently selected result ids. That means the visible tags and counts update as soon as the query, filters, or ranking mode changes.

## Learn more

- [Section and Tag Aggregations](./section-and-tag-aggregations.md)
- [Faceted search on Wikipedia](https://en.wikipedia.org/wiki/Faceted_search)
