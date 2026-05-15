---
id: serialization
section: Indexing
title: Portable JSON Index State
summary: Serialize index structures and hydrate them again without reindexing.
tags: [serialization, state, json, hydration, portability]
apis: [indexState, loadState, DocumentIndexState, TextFieldIndexState]
level: indexing
order: 20
---

# Portable JSON Index State

Querylight index state is intentionally JSON-serializable.

This page covers the smallest possible version of the pattern: serialize `indexState`, ship it, and hydrate it again later. For the broader deployment pattern around browser apps and static sites, see [Serialization, Hydration, and Shipping Indexes](./serialization-hydration-and-shipping-indexes.md).

## Serialize

```ts
const state = JSON.parse(JSON.stringify(index.indexState));
```

## Hydrate

```ts
const hydrated = index.loadState(state);
```

`loadState(...)` expects the same logical field layout you used when you built the index. If the runtime schema changes, rebuild and reship the JSON state.

## When to use it

- Precompute indexes at build time
- Ship them to the browser
- Avoid reindexing on startup
- Keep test fixtures deterministic

This pattern is a good fit when:

- the source documents already exist at build time
- startup latency matters more than extra build-time work
- the serialized payload still fits comfortably in browser or process memory
- you want deterministic fixtures for tests or demos

This is the recommended architecture for documentation and static-site search:

1. Build your `DocumentIndex` or `createSimpleTextSearchIndex(...)` bundle during your site build.
2. Serialize the resulting index state to JSON.
3. Fetch that JSON in the browser.
4. Hydrate the index state.
5. Run search queries locally in the browser.

That pattern keeps the runtime simple, avoids client-side reindexing, and gives you predictable startup cost.

## Learn more

- [Getting Started with Browser Search](./../overview/getting-started-with-browser-search.md)
- [JSON on Wikipedia](https://en.wikipedia.org/wiki/JSON)
- [RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259)
- [JSON.stringify() on MDN](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
