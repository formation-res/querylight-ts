---
id: trie-prefix
section: Indexing
title: Trie-Backed Prefix Expansion
summary: Querylight keeps indexed text terms in a trie so prefix queries can expand to real terms already present in the field vocabulary.
tags: [indexing, trie, prefix, autocomplete, vocabulary]
apis: [SimpleStringTrie, PrefixQuery, MatchQuery, TextFieldIndex, TrieNode]
level: indexing
order: 10
---

# Trie-Backed Prefix Expansion

Querylight stores the analyzed vocabulary of each `TextFieldIndex` in a trie.

That trie is what powers:

- `PrefixQuery`
- `MatchQuery(..., prefixMatch: true)`
- `MultiMatchQuery(..., prefixMatch: true)`

The important point is that Querylight is expanding prefixes against indexed terms that already exist in the field. It is not generating arbitrary substrings and it is not doing fuzzy autocomplete by itself.

## Basic usage

Most users do not need to instantiate `SimpleStringTrie` directly. You normally use it through text queries.

This example uses the default `TextFieldIndex` analyzer, which lowercases and tokenizes text into terms. These three documents produce the following title terms:

- document `1`: `"Querylight introduction"` -> `querylight`, `introduction`
- document `2`: `"Query planner basics"` -> `query`, `planner`, `basics`
- document `3`: `"Vector search guide"` -> `vector`, `search`, `guide`

Now search for the prefix `que`:

```ts
import {
  DocumentIndex,
  MatchQuery,
  OP,
  PrefixQuery,
  TextFieldIndex
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex()
});

index.index({ id: "1", fields: { title: ["Querylight introduction"] } });
index.index({ id: "2", fields: { title: ["Query planner basics"] } });
index.index({ id: "3", fields: { title: ["Vector search guide"] } });

const explicitPrefixHits = index.searchRequest({
  query: new PrefixQuery({ field: "title", prefix: "que" })
});

const analyzedPrefixHits = index.searchRequest({
  query: new MatchQuery({ field: "title", text: "que", operation: OP.OR, prefixMatch: true })
});

explicitPrefixHits.map(([id]) => id); // ["1", "2"]
analyzedPrefixHits.map(([id]) => id); // ["1", "2"]
```

Both queries rely on the field's trie to expand `que` into indexed terms such as `querylight` and `query`. Document `3` does not match because none of its indexed terms start with `que`.

If you search for `pla` with `new PrefixQuery({ field: "title", prefix: "pla" })`, only document `2` matches because `planner` starts with `pla`.

## How it works

Each analyzed term inserted into a text field is also inserted into a trie.

When Querylight evaluates a prefix lookup:

1. it walks the trie using the query text
2. it finds the deepest matching branch
3. it returns the indexed terms reachable from that branch
4. it resolves those terms back to matching documents

This means prefix matching is based on analyzed terms, not raw source text. If your analyzer lowercases text, strips punctuation, or tokenizes on whitespace, the trie sees those normalized tokens.

For example, if a title field analyzes `"Query Planner"` into `query` and `planner`, then:

- `que` can match `query`
- `pla` can match `planner`
- `ery` does not match anything, because this is not substring search

## What `SimpleStringTrie` actually returns

`SimpleStringTrie` is a small string trie with two relevant operations:

- `get(input)` returns the longest indexed complete term encountered while scanning the input, or `null`
- `match(input)` returns indexed terms that share the traversable prefix

Example:

```ts
import { SimpleStringTrie } from "@tryformation/querylight-ts";

const trie = new SimpleStringTrie();
["ab", "abc", "abcd", "abcde"].forEach((value) => trie.add(value));

trie.get("abczzz");   // "abc"
trie.match("ab");     // ["ab", "abc", "abcd", "abcde"]
trie.match("abc");    // ["abc", "abcd", "abcde"]
```

One non-obvious detail from the current implementation is that `match(input)` uses the deepest prefix it can traverse, even if the full input does not exist in the trie. For example, if only `"a"` is indexed, then `match("abc")` returns `["a"]`.

That behavior is intentional in the current codebase, so prefix expansion is closer to "expand from the deepest known prefix" than "require the whole query string to match a trie path".

## When to use it

Trie-backed prefix expansion is a good fit when:

- users type the beginning of a term
- you want matches only from known indexed vocabulary
- you want prefix matching to respect the field analyzer
- you want a compact autocomplete or search-as-you-type primitive without building a separate search service

`PrefixQuery` is the clearest API when prefix lookup is the whole query.

`MatchQuery(..., prefixMatch: true)` is useful when you still want analyzed text-query behavior such as `AND` or `OR` across multiple query terms.

## Trie expansion vs edge ngrams

Trie expansion and edge-ngram indexing solve related but different problems.

Use trie expansion when:

- you want to match real indexed terms
- you want no extra prefix tokens stored in the index
- you want explicit prefix semantics

Use edge ngrams when:

- you want a dedicated suggestion field
- you want prefixes to behave like ordinary analyzed text matching
- you want to tune the minimum and maximum prefix sizes at index time

Example edge-ngram analyzer:

```ts
import { Analyzer, EdgeNgramsTokenFilter } from "@tryformation/querylight-ts";

const suggestAnalyzer = new Analyzer(undefined, undefined, [
  new EdgeNgramsTokenFilter(2, 5)
]);
```

In practice, many autocomplete UIs work better with a dedicated edge-ngram suggestion field, while trie expansion stays useful for explicit prefix queries over the main text vocabulary.

## Limitations

- Prefix matching is term-based, not arbitrary substring matching.
- Behavior depends on the analyzer for the field.
- The trie only knows about indexed vocabulary, so unseen spellings do not match.
- Current expansion can fall back to the deepest known prefix instead of requiring the whole input to stay on a trie path.

If you need typo tolerance or infix matching, use other analysis strategies or a dedicated query path instead of relying on the trie alone.

## Related articles

- [Term, Terms, Prefix, Exists, and Match Queries](../lexical-querying/term-terms-prefix-exists-and-match-queries.md)
- [How To Build Autocomplete](../guides/how-to-build-autocomplete.md)
- [Analyzers, Tokenizers, and Filters](../analysis/analyzers-tokenizers-and-filters.md)
