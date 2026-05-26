---
id: phrase-search
section: Lexical Querying
title: Phrase Search and Slop
summary: Match analyzed terms in sequence, with optional movement tolerance, using the JSON DSL first.
tags: [query, phrase, slop, ranking, exactness]
apis: [MatchPhrase, Analyzer, TextFieldIndex]
level: querying
order: 30
---

# Phrase Search and Slop

`match_phrase` checks whether analyzed terms occur in order. The class form is still available as the equivalent internal TypeScript API.

## Exact phrase

```json
{
  "query": {
    "match_phrase": {
      "body": {
        "query": "vector search"
      }
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { MatchPhrase } from "@tryformation/querylight-ts";

const exact = new MatchPhrase({ field: "body", text: "vector search" });
```

## Phrase with slop

Slop allows nearby terms to count even when there is a little distance between them.

```json
{
  "query": {
    "match_phrase": {
      "body": {
        "query": "portable json index state",
        "slop": 2,
        "boost": 2
      }
    }
  }
}
```

## Good queries to try in the demo

- `"portable json index state"`
- `"vector search"`
- `"phrase search"`

## Learn more

- [Phrase search on Wikipedia](https://en.wikipedia.org/wiki/Phrase_search)
