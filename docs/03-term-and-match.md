---
id: term-and-match
section: Queries
title: TermQuery and MatchQuery
summary: Use exact term lookups or analyzed text matching, including prefix expansion from the trie.
tags: [query, term, match, prefix, trie]
apis: [TermQuery, MatchQuery, OP, SimpleStringTrie]
level: querying
order: "03"
city: Copenhagen
lat: 55.6761
lon: 12.5683
---

# TermQuery and MatchQuery

## TermQuery

`TermQuery` looks for an exact term in an indexed field. It does not analyze the input for you.

```ts
import { TermQuery } from "@querylight/core";

const query = new TermQuery("tags", "aggregation");
```

## MatchQuery

`MatchQuery` analyzes the input text and supports both `AND` and `OR` logic. It can also use trie-backed prefix expansion.

```ts
import { MatchQuery, OP } from "@querylight/core";

const bodyQuery = new MatchQuery("body", "vector search", OP.AND, false, 2.0);
const prefixQuery = new MatchQuery("title", "agg", OP.OR, true);
```

## When to prefer which

- Use `TermQuery` for exact facet values.
- Use `MatchQuery` for full text.
- Turn on `prefixMatch` when you want partial token lookup against known indexed terms.

## Learn more

- [Trie on Wikipedia](https://en.wikipedia.org/wiki/Trie)
