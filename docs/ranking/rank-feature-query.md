---
id: rank-feature-query
section: Ranking
title: RankFeatureQuery for Numeric Relevance Signals
summary: Boost documents with numeric features such as popularity, clicks, or quality scores.
tags: [ranking, rank-feature, numeric, relevance, scoring]
apis: [RankFeatureQuery, NumericFieldIndex]
level: advanced
order: 50
---

# RankFeatureQuery for Numeric Relevance Signals

`RankFeatureQuery` turns a numeric field into a scoring signal.

Typical examples:

- popularity
- download count
- click-through count
- editorial quality score

## Basic example

```ts
import {
  DocumentIndex,
  NumericFieldIndex,
  RankFeatureQuery
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  popularity: new NumericFieldIndex()
});

index.index({ id: "1", fields: { popularity: ["5"] } });
index.index({ id: "2", fields: { popularity: ["20"] } });
index.index({ id: "3", fields: { popularity: ["50"] } });

const hits = index.searchRequest({
  query: new RankFeatureQuery("popularity")
});
```

## Supported modes

### Saturation

Default behavior.

```ts
new RankFeatureQuery("popularity", { pivot: 10 });
```

Useful when you want diminishing returns.

### Log

```ts
new RankFeatureQuery("popularity", { type: "log", scalingFactor: 1 });
```

Useful when raw values grow very large.

### Sigmoid

```ts
new RankFeatureQuery("popularity", {
  type: "sigmoid",
  pivot: 10,
  exponent: 2
});
```

Useful when you want a stronger curve around a pivot.

### Linear

```ts
new RankFeatureQuery("popularity", { type: "linear", factor: 0.5 });
```

Useful when the feature should scale directly.

## Notes

- Map the field with `NumericFieldIndex` when possible.
- Documents with missing or non-positive values do not contribute useful scores.
- Rank features work best as one signal among several, not as the only ranking rule.
