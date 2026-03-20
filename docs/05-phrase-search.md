---
id: phrase-search
section: Queries
title: Phrase Search and Slop
summary: Match analyzed terms in sequence, with optional movement tolerance.
tags: [query, phrase, slop, ranking, exactness]
apis: [MatchPhrase, Analyzer, TextFieldIndex]
level: querying
order: "05"
city: Paris
lat: 48.8566
lon: 2.3522
---

# Phrase Search and Slop

`MatchPhrase` checks whether analyzed terms occur in order.

## Exact phrase

```ts
import { MatchPhrase } from "@querylight/core";

const exact = new MatchPhrase("body", "vector search");
```

## Phrase with slop

Slop allows nearby terms to count even when there is a little distance between them.

```ts
const tolerant = new MatchPhrase("body", "portable json index state", 2, 2.0);
```

## Good queries to try in the demo

- `"portable json index state"`
- `"vector search"`
- `"phrase search"`
