---
id: serialization
section: Operations
title: Portable JSON Index State
summary: Serialize index structures and hydrate them again without reindexing.
tags: [serialization, state, json, hydration, portability]
apis: [indexState, loadState, DocumentIndexState, TextFieldIndexState]
level: indexing
order: "12"
city: Helsinki
lat: 60.1699
lon: 24.9384
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
