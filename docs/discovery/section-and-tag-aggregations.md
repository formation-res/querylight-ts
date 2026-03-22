---
id: section-tag-aggregations
section: Discovery
title: Section and Tag Aggregations
summary: Use terms aggregations over section and tags fields to build navigational facets for documentation and content discovery.
tags: [aggregation, tags, section, facets, discovery, navigation]
apis: [termsAggregation, TextFieldIndex, TermQuery, DocumentIndex]
level: querying
order: 15
---

# Section and Tag Aggregations

`section` and `tags` are two of the most useful metadata fields for discovery-oriented search.

They answer slightly different questions:

- `section`: where in the corpus a result lives
- `tags`: what topics the result is about

Both are usually indexed as dedicated text fields and aggregated with `termsAggregation(...)`.

## Basic usage

```ts
import { DocumentIndex, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  section: new TextFieldIndex(),
  tags: new TextFieldIndex()
});

index.index({
  id: "intro",
  fields: {
    section: ["Overview"],
    tags: ["getting-started", "browser"]
  }
});

index.index({
  id: "facets",
  fields: {
    section: ["Guides"],
    tags: ["facets", "aggregations", "navigation"]
  }
});

index.index({
  id: "ranking",
  fields: {
    section: ["Ranking"],
    tags: ["bm25", "relevance"]
  }
});

const sectionIndex = index.getFieldIndex("section") as TextFieldIndex;
const tagsIndex = index.getFieldIndex("tags") as TextFieldIndex;

const sectionBuckets = sectionIndex.termsAggregation(10);
const tagBuckets = tagsIndex.termsAggregation(10);
```

Expected shape:

```ts
sectionBuckets = {
  Overview: 1,
  Guides: 1,
  Ranking: 1
};

tagBuckets = {
  getting-started: 1,
  browser: 1,
  facets: 1,
  aggregations: 1,
  navigation: 1,
  bm25: 1,
  relevance: 1
};
```

## How it works

These aggregations are usually most useful when you restrict them to the current hit set.

```ts
const hits = index.searchRequest({ query });
const subsetIds = new Set(hits.map(([id]) => id));

const visibleSections = sectionIndex.termsAggregation(10, subsetIds);
const visibleTags = tagsIndex.termsAggregation(12, subsetIds);
```

That gives you contextual facets:

- sections tell users where the current results are concentrated
- tags tell users which topics dominate the current slice

The counts are document counts, not raw token frequencies. A document contributes at most once to a given `section` bucket and at most once to each tag bucket.

## When to use it

Use `section` aggregations when users need orientation across major content areas.

Examples:

- `Overview`
- `Guides`
- `Discovery`
- `Operations`

Use `tags` aggregations when users need more specific topical refinement inside or across those areas.

Examples:

- `aggregations`
- `vector`
- `highlighting`
- `serialization`

Together they work well because `section` is coarse navigation and `tags` are finer-grained topic signals.

## Tradeoffs

These aggregations are only as good as the metadata model behind them.

- `section` values should be stable and few in number
- `tags` should stay human-readable and reasonably curated
- both fields should usually use keyword-like analysis so values are not split apart unexpectedly

If you need free-form vocabulary discovery instead of curated labels, use significant terms on a body field instead of relying only on tags.

## Related articles

- [Terms Aggregation and Significant Terms](./terms-aggregation-and-significant-terms.md)
- [How To Build Faceted Navigation](../guides/how-to-build-faceted-navigation.md)
- [How the Aggregations Sidebar Works](../demo/tag-aggregations-sidebar.md)
