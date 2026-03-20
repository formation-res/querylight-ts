---
id: shipping-indexes
section: Operations
title: Serialization, Hydration, and Shipping Indexes
summary: Prebuild index state, ship JSON to the client, and rehydrate fast without reindexing in the browser.
tags: [serialization, hydration, browser, build-time, deployment]
apis: [indexState, loadState, DocumentIndexState, DocumentIndex]
level: indexing
order: "26"
---

# Serialization, Hydration, and Shipping Indexes

One of the most useful deployment patterns in Querylight TS is to build indexes ahead of time and ship their serialized state to the browser.

That avoids reindexing large corpora on every page load.

## The basic idea

At build time:

1. create your `DocumentIndex`
2. index your documents once
3. serialize `indexState` to JSON

At runtime:

1. fetch or import the JSON
2. create an empty index with the same field layout
3. call `loadState(...)`

## Why this pattern works well

It is a good fit for:

- static sites
- documentation portals
- browser apps with bundled content
- offline-capable local search

It trades extra build-time work for a faster runtime experience.

## What to serialize

Usually you want:

- the index state
- a lightweight source-document map for rendering results
- optionally extra payloads such as vector embeddings or chunk metadata

Keep retrieval data and rendering data conceptually separate, even if they ship together.

## Browser tradeoffs

Prebuilt indexes make startup faster, but payload size still matters. To keep things practical:

- avoid indexing unnecessary fields
- use helper fields deliberately
- split large payloads if your app can lazy-load them

## Keep field definitions aligned

Hydration only works correctly when the runtime index is created with the same logical field layout used at build time.

If you change the schema, rebuild and reship the state.

## A common architecture

- build docs or records in CI
- emit JSON assets during the site build
- load the serialized state in the browser
- run queries locally with no backend dependency

This is one of the clearest ways to get fast, private, low-latency search into a frontend app.
