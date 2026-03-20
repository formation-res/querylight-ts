---
id: trie-prefix
section: Indexing
title: Trie-Backed Prefix Expansion
summary: Autocomplete-style search is built from indexed terms.
tags: [indexing, trie, prefix, autocomplete, edge-ngrams]
apis: [SimpleStringTrie, MatchQuery, EdgeNgramsTokenFilter]
level: indexing
order: "09"
city: Vienna
lat: 48.2082
lon: 16.3738
---

# Trie-Backed Prefix Expansion

Querylight stores indexed terms in a trie. Prefix queries can then expand against real vocabulary seen in the corpus.

## Prefix query

```ts
import { MatchQuery, OP } from "@querylight/core";

const query = new MatchQuery("title", "agg", OP.OR, true);
```

## Edge ngrams for suggestions

Edge ngrams are different from trie expansion. They are useful when you want indexed suggestion fragments instead of exact prefix expansion over known terms.

```ts
import { Analyzer, EdgeNgramsTokenFilter } from "@querylight/core";

const suggestAnalyzer = new Analyzer(undefined, undefined, [
  new EdgeNgramsTokenFilter(2, 5)
]);
```

## Learn more

- [Trie on Wikipedia](https://en.wikipedia.org/wiki/Trie)
- [N-gram on Wikipedia](https://en.wikipedia.org/wiki/N-gram)
- [All About Analyzers, Part One on the Elastic blog](https://www.elastic.co/blog/found-text-analysis-part-1)
