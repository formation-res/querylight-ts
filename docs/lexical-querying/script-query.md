---
id: script-query
section: Lexical Querying
title: ScriptQuery for Custom JavaScript Filters
summary: Filter documents with a JavaScript function when built-in query classes do not express the rule cleanly.
tags: [query, script, javascript, filtering, advanced]
apis: [ScriptQuery, ScriptExecutionContext]
level: advanced
order: 90
---

# ScriptQuery for Custom JavaScript Filters

`ScriptQuery` lets you filter documents with a JavaScript function.

Use it when the condition is too specific for the built-in query classes.

## Basic example

```ts
import {
  DocumentIndex,
  NumericFieldIndex,
  ScriptQuery,
  TextFieldIndex
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  popularity: new NumericFieldIndex(),
  title: new TextFieldIndex()
});

index.index({ id: "1", fields: { popularity: ["5"], title: ["alpha"] } });
index.index({ id: "2", fields: { popularity: ["20"], title: ["beta"] } });

const hits = index.searchRequest({
  query: new ScriptQuery(({ numericValue }) => (numericValue("popularity") ?? 0) >= 10)
});
```

## Available helpers

The script receives a context with:

- `document`
- `documentIndex`
- `score`
- `values(field)`
- `value(field)`
- `numericValues(field)`
- `numericValue(field)`

## Good uses

- one-off eligibility rules
- field combinations that would be awkward in bool logic
- filters that depend on numeric parsing

## Notes

- This is flexible but less declarative than built-in queries.
- Prefer normal query classes when they already express the behavior clearly.
- `ScriptQuery` returns matching documents with a base score of `1.0`.
