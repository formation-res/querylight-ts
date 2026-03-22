---
id: significant-terms-aggregation
section: Aggregations
title: Significant Terms Aggregation
summary: Surface terms that are unusually common in the current subset compared to the background corpus.
tags: [aggregation, significant-terms, discovery, analytics, vocabulary]
apis: [significantTermsAggregation, SignificantTermsBucket, TextFieldIndex, DocumentIndex]
level: advanced
order: 11
---

# Significant Terms Aggregation

`significantTermsAggregation` surfaces terms that stand out in a subset relative to the full corpus.

This is useful when you want to answer "what is distinctive about these results?" rather than "which facet values are most common?"

## Basic usage

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
const standoutTerms = bodyIndex.significantTermsAggregation(8, subsetIds);
```

Expected shape:

```ts
[
  {
    key: "vector",
    score: 1.5,
    subsetDocCount: 2,
    backgroundDocCount: 2
  },
  {
    key: "embeddings",
    score: 1.5,
    subsetDocCount: 1,
    backgroundDocCount: 1
  }
]
```

## How it works

`significantTermsAggregation` compares:

- how often a term appears in the current subset
- how often the same term appears in the full background corpus

Terms that are common everywhere are less interesting. Terms that spike in the current slice rank higher.

## When to use it

Use significant terms for:

- suggested follow-up queries
- sidebar hints
- exploratory vocabulary prompts
- understanding why a filtered slice looks different from the rest of the corpus

It works best on descriptive text fields such as `body`, `summary`, or `description`.

## Limitations

- It is not a stable facet-count API.
- Small subsets can produce noisy output.
- Curated metadata fields such as `tags` or `section` often work better with [Terms Aggregation](./terms-aggregation.md).

## Related articles

- [Terms Aggregation](./terms-aggregation.md)
- [How To Build Faceted Navigation](../guides/how-to-build-faceted-navigation.md)
- [How the Aggregations Sidebar Works](../demo/tag-aggregations-sidebar.md)
