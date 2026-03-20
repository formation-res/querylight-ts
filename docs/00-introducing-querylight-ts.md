---
id: introducing-querylight-ts
section: Overview
title: Introducing Querylight TS
summary: Why this TypeScript port exists, who it is for, and where it fits relative to established search tools.
tags: [overview, browser, static-sites, search, vector, geo]
apis: [DocumentIndex, TextFieldIndex, VectorFieldIndex, GeoFieldIndex]
level: foundation
order: "00"
city: Amsterdam
lat: 52.3676
lon: 4.9041
---

# Introducing Querylight TS

Querylight TS is a TypeScript port of the original [`querylight`](https://github.com/jillesvangurp/querylight) library, built for browser and Node.js use cases where shipping a full search server would be excessive.

The project focuses on a practical middle ground: more capable than simple fuzzy matching, much smaller in scope than a full Lucene-based search stack. You can use it to add fast, local, explainable search to static sites, browser apps, demos, documentation portals, and other small to medium datasets.

## Who it is for

Querylight TS is a good fit if you have a static website or browser application and want search features without depending on a remote backend for every query.

Typical use cases include:

- Full-text search for documentation, blogs, and content-heavy static sites
- Search-as-you-type suggestions
- Faceting and filtering over structured metadata
- Geo search for location-aware content
- Lightweight vector search for similarity and recommendation features
- Offline or local-first retrieval experiments in the browser

If you want to get ambitious, you can even pair it with in-browser or WASM-based embedding models and keep the entire retrieval pipeline client-side.

## Where it came from

The original Querylight project started as a hobby project built around tries and lightweight term matching. Over time it grew into a broader retrieval toolkit with TF-IDF ranking, BM25, phrase queries, aggregations, geo search, vector search, and query composition.

That evolution reflects my own background. I have spent most of my career working with search systems such as [Lucene](https://lucene.apache.org/), [Solr](https://solr.apache.org/), [Elasticsearch](https://www.elastic.co/elasticsearch), and [OpenSearch](https://opensearch.org/). Querylight TS is informed by that experience, but it is intentionally not trying to reproduce those systems in miniature.

The TypeScript port exists because modern browser applications increasingly need search features that are local, portable, and easy to ship. With current AI-assisted coding workflows, building and iterating on the port became much faster. That changes how the code gets written, but it does not remove the need for sound information retrieval concepts, testing, and engineering discipline.

## What you can build with it

Querylight TS supports several retrieval patterns under one API:

- Lexical search with TF-IDF and BM25 ranking
- Structured boolean queries
- Phrase queries and prefix expansion
- Aggregations and significant terms
- Vector-based similarity search
- Geo indexing and querying
- JSON-serializable index state for build-time generation and browser hydration

That combination makes it useful for more than a search box. It can also power "related articles", typo-tolerant discovery, filtered navigation, and hybrid ranking strategies.

## Is it better than X?

Usually that is the wrong question.

There are many search libraries and products, and search is one of those domains where people regularly build a side project and then claim it replaces Elasticsearch. Querylight TS is not presented that way. It is not a replacement for Elasticsearch, OpenSearch, Solr, or Lucene. Those systems are far more mature, scalable, and operationally complete.

The more useful question is whether Querylight TS is the right amount of search for your problem.

If you need distributed indexing, large-scale operations, advanced relevance tooling, or the broad ecosystem around established search servers, use those tools.

If you need a lightweight in-process search toolkit for browser or Node.js applications, Querylight TS may be a better fit.

Compared to smaller client-side libraries such as [`fuse.js`](https://github.com/krisk/Fuse), Querylight TS aims to cover a wider slice of retrieval functionality. That does not automatically make it better. `fuse.js` is excellent at being simple, useful, and easy to adopt. Querylight TS gives you more building blocks, but whether you need them depends on your application.

## Repositories

- TypeScript port: [`formation-res/querylight-ts`](https://github.com/formation-res/querylight-ts)
- Original library: [`jillesvangurp/querylight`](https://github.com/jillesvangurp/querylight)

## Related work

- [`fuse.js`](https://github.com/krisk/Fuse)
- [Apache Lucene](https://lucene.apache.org/)
- [Apache Solr](https://solr.apache.org/)
- [Elasticsearch](https://www.elastic.co/elasticsearch)
- [OpenSearch](https://opensearch.org/)
