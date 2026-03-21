---
id: script-score-query
section: Ranking
title: ScriptScoreQuery for Custom JavaScript Scoring
summary: Rescore matching documents with a JavaScript function that combines `_score` with your own business logic.
tags: [ranking, script-score, javascript, relevance, custom-scoring]
apis: [ScriptScoreQuery, ScriptExecutionContext, TermQuery]
level: advanced
order: "40"
---

# ScriptScoreQuery for Custom JavaScript Scoring

`ScriptScoreQuery` runs a base query first and then replaces each hit score with the result of a JavaScript function.

That makes it useful when you want to combine lexical relevance with a custom formula.

## Basic example

```ts
import {
  DocumentIndex,
  NumericFieldIndex,
  ScriptScoreQuery,
  TermQuery,
  TextFieldIndex
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  popularity: new NumericFieldIndex(),
  title: new TextFieldIndex()
});

index.index({ id: "1", fields: { popularity: ["5"], title: ["querylight"] } });
index.index({ id: "2", fields: { popularity: ["20"], title: ["querylight"] } });

const hits = index.searchRequest({
  query: new ScriptScoreQuery(
    new TermQuery("title", "querylight"),
    ({ score, numericValue }) => score * (numericValue("popularity") ?? 1)
  )
});
```

## Available helpers

The scoring function receives:

- `score`: the base score from the wrapped query
- `document`
- `documentIndex`
- `values(field)`
- `value(field)`
- `numericValues(field)`
- `numericValue(field)`

## Good uses

- Multiply lexical relevance by a popularity score.
- Blend exact-match score with freshness or quality.
- Apply a custom ranking formula without building a new query class.

## Notes

- The wrapped query decides which documents are candidates.
- Non-finite or non-positive script results are dropped.
- Keep the function deterministic and easy to reason about.
