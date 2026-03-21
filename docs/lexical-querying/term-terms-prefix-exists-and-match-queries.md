---
id: term-and-match
section: Lexical Querying
title: Term, Terms, Prefix, Exists, and Match Queries
summary: Use exact term lookups, field existence checks, prefix lookup, or analyzed text matching.
tags: [query, term, match, prefix, trie]
apis: [TermQuery, TermsQuery, PrefixQuery, ExistsQuery, MatchQuery, MultiMatchQuery, OP, SimpleStringTrie]
level: querying
order: 10
---

# Term, Terms, Prefix, Exists, and Match Queries

## TermQuery

`TermQuery` looks for an exact term in an indexed field. It does not analyze the input for you.

```ts
import { TermQuery } from "@tryformation/querylight-ts";

const query = new TermQuery("tags", "aggregation");
```

## TermsQuery

`TermsQuery` is the exact-match any-of variant for faceting and filters.

```ts
import { TermsQuery } from "@tryformation/querylight-ts";

const query = new TermsQuery("tags", ["aggregation", "highlighting"]);
```

## PrefixQuery

`PrefixQuery` looks for indexed terms that start with a prefix. It is useful for autocomplete-style retrieval when you want the query intent to be explicit instead of toggling `prefixMatch` on `MatchQuery`.

```ts
import { PrefixQuery } from "@tryformation/querylight-ts";

const query = new PrefixQuery("title", "agg");
```

## ExistsQuery

`ExistsQuery` filters documents that have at least one stored value for a field.

```ts
import { ExistsQuery } from "@tryformation/querylight-ts";

const query = new ExistsQuery("location");
```

## MatchQuery

`MatchQuery` analyzes the input text and supports both `AND` and `OR` logic. It can also use trie-backed prefix expansion.

```ts
import { MatchQuery, OP } from "@tryformation/querylight-ts";

const bodyQuery = new MatchQuery("body", "vector search", OP.AND, false, 2.0);
const prefixQuery = new MatchQuery("title", "agg", OP.OR, true);
```

## MultiMatchQuery

`MultiMatchQuery` lets terms match across several fields instead of forcing one field to satisfy the whole query.

```ts
import { MultiMatchQuery } from "@tryformation/querylight-ts";

const query = new MultiMatchQuery(["title", "body"], "vector search");
```

## When to prefer which

- Use `TermQuery` for exact facet values.
- Use `TermsQuery` for exact any-of filters.
- Use `PrefixQuery` for explicit autocomplete-style matching.
- Use `ExistsQuery` when optional metadata should become a filter.
- Use `MatchQuery` for full text.
- Use `MultiMatchQuery` when query terms may be spread across several fields.
- Turn on `prefixMatch` when you want partial token lookup against known indexed terms.

## Learn more

- [Trie on Wikipedia](https://en.wikipedia.org/wiki/Trie)
