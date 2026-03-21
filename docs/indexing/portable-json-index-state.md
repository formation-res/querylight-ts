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

## Serialize

```ts
const state = JSON.parse(JSON.stringify(index.indexState));
```

## Hydrate

```ts
const hydrated = index.loadState(state);
```

## Why it is useful

- Precompute indexes at build time
- Ship them to the browser
- Avoid reindexing on startup
- Keep test fixtures deterministic

This is the recommended architecture for documentation and static-site search:

1. Build your `DocumentIndex` or `createSimpleTextSearchIndex(...)` bundle during your site build.
2. Serialize the resulting index state to JSON.
3. Fetch that JSON in the browser.
4. Hydrate the index state.
5. Run search queries locally in the browser.

That pattern keeps your runtime simple and gives users a responsive search box without a search server.

## Learn more

- [Getting Started with Browser Search](./../overview/getting-started-with-browser-search.md)
- [JSON on Wikipedia](https://en.wikipedia.org/wiki/JSON)
- [RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259)
- [JSON.stringify() on MDN](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
