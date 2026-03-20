---
id: testing-patterns
section: Operations
title: Testing Patterns from the Repository
summary: The test suite documents expected ranking, query, vector, and geo behavior.
tags: [testing, vitest, examples, semantics, confidence]
apis: [BoolQuery, RangeQuery, VectorFieldIndex, GeoFieldIndex]
level: advanced
order: "13"
city: Dublin
lat: 53.3498
lon: -6.2603
---

# Testing Patterns from the Repository

The repository tests are worth reading because they define the intended semantics of the library.

## Examples covered in tests

- phrase search
- BM25 score stability
- bool query logic
- range filters
- trie prefix behavior
- vector retrieval
- geo queries
- significant terms

```ts
expect(index.searchRequest({
  query: new MatchPhrase("description", "to be or not to be")
})).toHaveLength(1);
```

```ts
expect(index.search(new MatchQuery("text", "foo"))[0]?.[0]).toBe("1");
```
