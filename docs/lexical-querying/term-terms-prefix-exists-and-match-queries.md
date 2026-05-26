---
id: term-and-match
section: Lexical Querying
title: Term, Terms, Prefix, Exists, and Match Queries
summary: Use exact term lookups, field existence checks, prefix lookup, or analyzed text matching through the JSON DSL.
tags: [query, term, match, prefix, trie]
apis: [searchJsonDsl, parseJsonDslQuery, TermQuery, TermsQuery, PrefixQuery, ExistsQuery, MatchQuery, MultiMatchQuery, OP, SimpleStringTrie]
level: querying
order: 10
---

# Term, Terms, Prefix, Exists, and Match Queries

The JSON DSL is the primary query format in these docs. Each section also shows the equivalent lower-level TypeScript query class.

## Term Query

Exact `term` lookup does not analyze the input for you.

```json
{
  "query": {
    "term": {
      "tags": "aggregation"
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { TermQuery } from "@tryformation/querylight-ts";

const query = new TermQuery({ field: "tags", text: "aggregation" });
```

## Terms Query

Exact `terms` lookup is the any-of variant for faceting and filters.

```json
{
  "query": {
    "terms": {
      "tags": ["aggregation", "highlighting"]
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { TermsQuery } from "@tryformation/querylight-ts";

const query = new TermsQuery({ field: "tags", terms: ["aggregation", "highlighting"] });
```

## Prefix Query

`prefix` lookup expands against the field trie and returns documents containing the matching indexed terms.

It is useful for autocomplete-style retrieval when you want prefix lookup to be explicit instead of toggling `prefixMatch` on `MatchQuery`.

```json
{
  "query": {
    "prefix": {
      "title": "agg"
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { PrefixQuery } from "@tryformation/querylight-ts";

const query = new PrefixQuery({ field: "title", prefix: "agg" });
```

## Exists Query

`exists` filters documents that have at least one stored value for a field.

```json
{
  "query": {
    "exists": {
      "field": "location"
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { ExistsQuery } from "@tryformation/querylight-ts";

const query = new ExistsQuery({ field: "location" });
```

## Match Query

`match` analyzes the input text and supports both `and` and `or` logic. When `prefix_match` is `true`, each analyzed query term can expand through the field trie before document scoring.

```json
{
  "query": {
    "match": {
      "body": {
        "query": "vector search",
        "operator": "and",
        "boost": 2
      }
    }
  }
}
```

```json
{
  "query": {
    "match": {
      "title": {
        "query": "agg",
        "operator": "or",
        "prefix_match": true
      }
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { MatchQuery, OP } from "@tryformation/querylight-ts";

const bodyQuery = new MatchQuery({ field: "body", text: "vector search", operation: OP.AND, boost: 2.0 });
const prefixQuery = new MatchQuery({ field: "title", text: "agg", operation: OP.OR, prefixMatch: true });
```

## Multi Match Query

`multi_match` lets terms match across several fields instead of forcing one field to satisfy the whole query.

```json
{
  "query": {
    "multi_match": {
      "fields": ["title", "body"],
      "query": "vector search"
    }
  }
}
```

Equivalent internal TypeScript API:

```ts
import { MultiMatchQuery } from "@tryformation/querylight-ts";

const query = new MultiMatchQuery({ fields: ["title", "body"], text: "vector search" });
```

## When to prefer which

- Use `TermQuery` for exact facet values.
- Use `TermsQuery` for exact any-of filters.
- Use `PrefixQuery` for explicit autocomplete-style matching.
- Use `ExistsQuery` when optional metadata should become a filter.
- Use `MatchQuery` for full text.
- Use `MultiMatchQuery` when query terms may be spread across several fields.
- Turn on `prefixMatch` when you want partial token lookup against known indexed terms instead of exact analyzed terms only.

## Learn more

- [Trie-Backed Prefix Expansion](../indexing/trie-backed-prefix-expansion.md)
- [Trie on Wikipedia](https://en.wikipedia.org/wiki/Trie)
