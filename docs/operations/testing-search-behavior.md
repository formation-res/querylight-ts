---
id: testing-search-behavior
section: Operations
title: Testing Search Behavior
summary: Write tests around ranking, filtering, edge cases, and representative user queries instead of only API smoke tests.
tags: [testing, ranking, queries, relevance, vitest]
apis: [DocumentIndex, BoolQuery, MatchQuery, MatchPhrase, RangeQuery]
level: advanced
order: 30
---

# Testing Search Behavior

Search bugs are often semantic. The code may run fine while the results are still wrong.

That means search testing should check behavior, not just execution.

## What to test

Useful search tests cover:

- whether the right documents match
- whether obvious results rank near the top
- whether filters exclude the right documents
- whether phrase or range behavior matches expectations
- whether edge cases stay stable

## Prefer small corpora with clear intent

A good test corpus is tiny but purposeful. Each document should exist for a reason:

- one should be an exact title hit
- one should be a noisy near match
- one should test exclusions
- one should test a boundary condition

That makes failures easier to interpret.

## Ranking assertions should stay pragmatic

Ranking tests are easiest to maintain when they assert what really matters.

Examples:

- the best document appears first
- a known relevant document appears in the top 3
- an excluded document does not appear at all

Avoid over-specifying every exact score unless score math itself is the thing under test.

## Test representative queries

Treat your expected user queries as fixtures:

- short exact queries
- partial queries
- phrase-like queries
- typo-heavy queries
- filter combinations

That gives you an early warning when a schema or analyzer change shifts behavior.

## Why this matters

Search quality regresses quietly. A normal unit test may still pass while relevance gets noticeably worse. Behavioral search tests help catch that before users do.
