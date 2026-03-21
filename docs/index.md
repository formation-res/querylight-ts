---
id: documentation-index
section: Overview
title: Documentation Index
summary: A section-by-section map of the Querylight TS documentation.
tags: [overview, docs, navigation, reference]
apis: [DocumentIndex, TextFieldIndex, Analyzer, MatchQuery, RankingAlgorithm]
level: foundation
order: 5
---

# Documentation Index

This index mirrors the documentation table of contents used by the demo.

## Overview

- [Introducing Querylight TS](./overview/introduction.md)
- [What Querylight TS Covers](./overview/what-querylight-ts-covers.md)
- [Getting Started with Browser Search](./overview/getting-started-with-browser-search.md)
- [Comparing Querylight TS to Other Browser Search Libraries](./overview/browser-search-library-comparison.md)
- [Other Work Related to Querylight TS](./overview/other-work-related-to-querylight-ts.md)

## Schema

- [Choosing a Schema for Search](./schema/choosing-a-schema-for-search.md)

## Analysis

- [Analyzers, Tokenizers, and Filters](./analysis/analyzers-tokenizers-and-filters.md)
- [Analyzer and Tokenization Deep Dive](./analysis/analyzer-and-tokenization-deep-dive.md)

## Lexical Querying

- [Term, Terms, Prefix, Exists, and Match Queries](./lexical-querying/term-terms-prefix-exists-and-match-queries.md)
- [BoolQuery for Must, Should, Filter, MustNot, and MinimumShouldMatch](./lexical-querying/bool-query.md)
- [Phrase Search and Slop](./lexical-querying/phrase-search-and-slop.md)
- [RangeQuery Over Lexical Fields](./lexical-querying/range-query-over-lexical-fields.md)
- [DisMaxQuery for Best-Field Matching with Tie Breakers](./lexical-querying/dis-max-query.md)
- [BoostingQuery for Soft Demotion Instead of Hard Exclusion](./lexical-querying/boosting-query.md)
- [WildcardQuery for Term-Level Pattern Matching](./lexical-querying/wildcard-query.md)
- [RegexpQuery for Term-Level Regular Expressions](./lexical-querying/regexp-query.md)
- [ScriptQuery for Custom JavaScript Filters](./lexical-querying/script-query.md)

## Ranking

- [TF-IDF and BM25 Ranking](./ranking/tfidf-and-bm25-ranking.md)
- [Reciprocal Rank Fusion](./ranking/reciprocal-rank-fusion.md)
- [Relevance Tuning with BM25, TF-IDF, and RRF](./ranking/relevance-tuning.md)
- [DistanceFeatureQuery for Recency and Numeric Closeness](./ranking/distance-feature-query.md)
- [RankFeatureQuery for Numeric Relevance Signals](./ranking/rank-feature-query.md)
- [ScriptScoreQuery for Custom JavaScript Scoring](./ranking/script-score-query.md)

## Discovery

- [Terms Aggregation and Significant Terms](./discovery/terms-aggregation-and-significant-terms.md)

## Indexing

- [Trie-Backed Prefix Expansion](./indexing/trie-backed-prefix-expansion.md)
- [Portable JSON Index State](./indexing/portable-json-index-state.md)
- [Serialization, Hydration, and Shipping Indexes](./indexing/serialization-hydration-and-shipping-indexes.md)
- [NumericFieldIndex and DateFieldIndex for Structured Features](./indexing/numeric-and-date-fields.md)

## Other Features

- [SimpleTextSearch for Plain JSON Documents](./features/simple-text-search-for-plain-json-documents.md)
- [Highlighting with Querylight TS](./features/highlighting-with-querylight-ts.md)
- [Approximate Nearest Neighbor Vector Search](./features/approximate-nearest-neighbor-vector-search.md)
- [Geo Indexing with Points and Polygons](./features/geo-indexing-with-points-and-polygons.md)
- [Document Chunking Strategies](./features/document-chunking-strategies.md)
- [Vector Rescoring for Faster Hybrid Search](./features/vector-rescoring-for-faster-hybrid-search.md)

## Guides

- [How To Build Autocomplete](./guides/how-to-build-autocomplete.md)
- [How To Build Faceted Navigation](./guides/how-to-build-faceted-navigation.md)
- [Real-World Recipes](./guides/real-world-recipes.md)

## Demo Internals

- [Ask the Docs End to End](./demo/ask-the-docs-end-to-end.md)
- [How the Tag Aggregations Sidebar Works](./demo/tag-aggregations-sidebar.md)

## Operations

- [Testing Patterns from the Repository](./operations/testing-patterns-from-the-repository.md)
- [Performance and Memory Tuning](./operations/performance-and-memory-tuning.md)
- [Testing Search Behavior](./operations/testing-search-behavior.md)
