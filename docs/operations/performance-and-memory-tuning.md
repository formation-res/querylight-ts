---
id: performance-and-memory-tuning
section: Operations
title: Performance and Memory Tuning
summary: Control index size and query cost by choosing fields, analyzers, and precomputation strategies carefully.
tags: [performance, memory, indexing, browser, tuning]
apis: [DocumentIndex, TextFieldIndex, VectorFieldIndex, NgramTokenFilter]
level: advanced
order: 20
---

# Performance and Memory Tuning

Querylight TS is lightweight, but retrieval still has real costs. Index size, analyzer choice, and field duplication all affect memory usage and query latency.

## What usually costs the most

Common cost drivers include:

- very large body fields
- too many duplicated helper fields
- ngram-heavy typo-recovery indexes
- large vector payloads
- shipping more metadata than the UI actually needs

## Start by trimming the schema

The fastest and cheapest field is the one you never index.

Ask:

- Does this field need to be searchable?
- Does it need full-text behavior or only filtering?
- Does it need its own helper field?

Small schema decisions compound quickly.

## Use specialized fields selectively

Ngram and edge-ngram fields are useful, but they should usually exist only for specific jobs such as:

- typo recovery
- autocomplete

Do not apply them broadly to every content field unless you have measured a real benefit.

## Build-time precomputation helps

For browser apps, precomputing at build time is often the biggest win:

- index once in CI or your site build
- serialize the state
- hydrate in the browser

That shifts work away from the user’s device at startup.

## Profile realistic workloads

Measure with:

- representative document counts
- real field sizes
- realistic query mixes

A tiny toy corpus can hide problems that appear immediately on a real docs set or product catalog.

## Practical guidance

- keep helper fields short
- avoid storing whole documents in several searchable fields
- use vectors only where they add clear value
- lazy-load expensive semantic features when possible

Performance tuning starts with disciplined data modeling, not micro-optimizing query code.
