---
id: other-related-work
section: Overview
title: Other Work Related to Querylight TS
summary: A map of adjacent projects by Jilles van Gurp around search, ranking, Elasticsearch, geo, and DSL tooling.
tags: [ecosystem, querylight, kt-search, rankquest, geo, vector]
apis: [DocumentIndex, VectorFieldIndex, GeoFieldIndex, reciprocalRankFusion]
level: foundation
order: "30"
---

# Other Work Related to Querylight TS

Querylight TS sits in a broader ecosystem of search-related projects. Some of these are directly related, some solve adjacent problems, and some are supporting libraries that make search systems easier to build.

This article covers the current, non-deprecated projects that are most relevant around Querylight TS.

For the Elasticsearch and OpenSearch client line, this intentionally focuses on [`kt-search`](https://github.com/jillesvangurp/kt-search) and excludes older deprecated repositories such as `es-kotlin-client`.

## Querylight

Repository: [`jillesvangurp/querylight`](https://github.com/jillesvangurp/querylight)

This is the Kotlin multiplatform predecessor and sibling project to Querylight TS.

It provides:

- in-memory text indexing
- a small query DSL
- TF-IDF and BM25 ranking
- aggregations
- serialization of index state
- optional vector indexing

If you want to understand where Querylight TS comes from conceptually, this is the most direct related project. The TypeScript port keeps the same general spirit: lightweight, local, structured retrieval without requiring a search server.

## kt-search

Repository: [`jillesvangurp/kt-search`](https://github.com/jillesvangurp/kt-search)

`kt-search` is the active Kotlin multiplatform client for Elasticsearch and OpenSearch.

It is for:

- talking to Elasticsearch and OpenSearch from Kotlin
- building queries, mappings, templates, and bulk requests with Kotlin DSLs
- running search and indexing logic on JVM, JS, and other Kotlin targets
- operating search clusters from scripts, tools, and applications

This sits at the opposite end of the spectrum from Querylight TS. Querylight TS is for local in-memory search in a browser or Node.js process. `kt-search` is for integrating with full external search engines.

If Querylight TS answers "how do I ship search with my app without a backend search service?", `kt-search` answers "how do I use Elasticsearch or OpenSearch productively from Kotlin?"

## Rankquest Core

Repository: [`jillesvangurp/rankquest-core`](https://github.com/jillesvangurp/rankquest-core)

`rankquest-core` is a Kotlin multiplatform relevance evaluation library.

It is for:

- measuring search quality
- scoring ranked result lists with metrics such as precision, recall, MRR, ERR, DCG, and NDCG
- defining portable test cases for search APIs

This is relevant to Querylight TS because retrieval quality is not just about implementing a query engine. At some point you need to evaluate whether ranking is actually good. `rankquest-core` addresses that measurement problem.

## Rankquest Studio

Repository: [`jillesvangurp/rankquest-studio`](https://github.com/jillesvangurp/rankquest-studio)

`rankquest-studio` is the browser-based UI built around Rankquest.

It is for:

- creating rated search test cases
- running ranking metrics in a visual UI
- exploring search quality over time
- exporting JSON configurations and judgments

Where Querylight TS helps you build retrieval into an application, Rankquest Studio helps you evaluate whether the results are good enough.

## Rankquest CLI

Repository: [`jillesvangurp/rankquest-cli`](https://github.com/jillesvangurp/rankquest-cli)

`rankquest-cli` is the command-line companion to Rankquest Studio and Rankquest Core.

It is for:

- running ranking test suites from exported JSON
- integrating relevance testing into local workflows
- enforcing search quality checks in CI

This is relevant if you move from experimenting with search to maintaining it as part of a production workflow.

## JsonDsl

Repository: [`jillesvangurp/json-dsl`](https://github.com/jillesvangurp/json-dsl)

`json-dsl` is a Kotlin multiplatform library for building extensible Kotlin DSLs for JSON and YAML dialects.

It is for:

- creating Kotlin-first DSLs over JSON structures
- keeping DSLs extensible when upstream formats evolve
- supporting plugin-specific fields without redesigning the whole type model

This matters because `kt-search` uses it for Elasticsearch and OpenSearch DSLs. It is less directly related to Querylight TS itself, but it is part of the broader toolchain around search-oriented developer experience.

## GeoGeometry

Repository: [`jillesvangurp/geogeometry`](https://github.com/jillesvangurp/geogeometry)

`geogeometry` is a Kotlin multiplatform geospatial algorithms library.

It is for:

- geohashes
- GeoJSON manipulation
- polygon and point geometry operations
- coordinate conversions
- shape covering and other geo-indexing helpers

This is relevant to Querylight TS because Querylight TS includes geo search support. The overlap is conceptual rather than implementation-level: both projects care about lightweight search and retrieval primitives, including geospatial ones.

## kt-search Logback Appender

Repository: [`jillesvangurp/kt-search-logback-appender`](https://github.com/jillesvangurp/kt-search-logback-appender)

This project uses `kt-search` to bulk-index Logback events into Elasticsearch or OpenSearch.

It is for:

- shipping JVM application logs into a search cluster
- structuring log events for search and dashboarding
- making exception and MDC data searchable

This is adjacent rather than directly connected to Querylight TS, but it shows another practical use of the search tooling ecosystem: operational logging and observability.

## OpenAI Embeddings Processor

Repository: [`jillesvangurp/openai-embeddings-processor`](https://github.com/jillesvangurp/openai-embeddings-processor)

This is a small utility project for generating embeddings for vector-search experiments.

It is for:

- preparing embeddings outside the main application
- experimenting with vector retrieval
- exploring semantic search workflows

This connects naturally to Querylight TS because Querylight TS has vector search support and the demo includes semantic "ask the docs" style retrieval.

## How these projects fit together

A useful mental model is:

- Querylight TS: local in-process search for TypeScript
- Querylight: the Kotlin sibling and conceptual predecessor
- kt-search: remote search engine integration for Elasticsearch and OpenSearch
- Rankquest: measurement and evaluation of ranking quality
- JsonDsl: DSL infrastructure used by the server-search client ecosystem
- GeoGeometry: geospatial foundations for geo-oriented retrieval work
- embeddings tooling: experiments and support for semantic retrieval

Together these projects cover a wide slice of search work:

- local search
- server-backed search
- relevance evaluation
- geo search
- vector search
- developer tooling and DSL ergonomics
