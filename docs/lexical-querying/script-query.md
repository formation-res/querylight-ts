---
id: script-query
section: Lexical Querying
title: ScriptQuery for Custom JavaScript Filters
summary: Filter documents with a JavaScript function when built-in query types do not express the rule cleanly.
tags: [query, script, javascript, filtering, advanced]
apis: [ScriptQuery, ScriptExecutionContext]
level: advanced
order: 90
---

# ScriptQuery for Custom JavaScript Filters

`script` lets you filter documents with a JavaScript function.

Use it when the condition is too specific for the built-in query classes.

## Basic example

```json
{
  "query": {
    "script": {
      "script": {
        "source": "(numericValue(\"popularity\") ?? 0) >= 10"
      }
    }
  }
}
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
- Prefer normal query types when they already express the behavior clearly.
- `script` returns matching documents with a base score of `1.0`.
