---
id: trie-prefix
section: Indexing
title: Trie-Backed Prefix Expansion
summary: Autocomplete-style search is built from indexed terms.
tags: [indexing, trie, prefix, autocomplete, edge-ngrams]
apis: [SimpleStringTrie, MatchQuery, EdgeNgramsTokenFilter]
level: indexing
order: "09"
---

# Trie-Backed Prefix Expansion

Querylight stores indexed terms in a trie. Prefix queries can then expand against real vocabulary seen in the corpus.

## Prefix query

```ts
import { MatchQuery, OP } from "@tryformation/querylight-ts";

const query = new MatchQuery("title", "agg", OP.OR, true);
```

## Edge ngrams for suggestions

Edge ngrams are different from trie expansion. They are useful when you want indexed suggestion fragments instead of exact prefix expansion over known terms.

```ts
import { Analyzer, EdgeNgramsTokenFilter } from "@tryformation/querylight-ts";

const suggestAnalyzer = new Analyzer(undefined, undefined, [
  new EdgeNgramsTokenFilter(2, 5)
]);
```

## Learn more

- [Trie on Wikipedia](https://en.wikipedia.org/wiki/Trie)
- [N-gram on Wikipedia](https://en.wikipedia.org/wiki/N-gram)
