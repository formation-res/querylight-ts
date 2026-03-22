# Querylight TS 0.9.2

Querylight TS is a pure TypeScript in-memory search toolkit for browser and Node.js applications that combines lexical, vector, geo, faceted, and analytics-style search patterns in one local package.

This patch release focuses on the post-`0.9.1` search/runtime work: async search execution in the library, pluggable async vector scoring, and demo improvements around semantic search stability and routing.

Links:

- Demo: [https://querylight.tryformation.com/](https://querylight.tryformation.com/)
- npm package: [https://www.npmjs.com/package/@tryformation/querylight-ts](https://www.npmjs.com/package/@tryformation/querylight-ts)
- Repository: [https://github.com/formation-res/querylight-ts](https://github.com/formation-res/querylight-ts)

## Highlights

- makes `DocumentIndex` search entry points async so query execution can use async scoring backends
- adds pluggable vector scoring interfaces plus exported CPU/default scorer types for ANN and reranking flows
- upgrades the demo ask-the-docs experience with a WebGPU vector scorer and automatic CPU fallback
- switches semantic answer ranking to exact reranking across the loaded chunk set for more stable result ordering
- fixes doc section-link routing in the demo and adds regression coverage for that navigation path

## API Compatibility Note

This release stays on the `0.9.x` pre-`1.0` line, but it does include API surface changes: search methods such as `DocumentIndex.search`, `searchRequest`, `count`, `simpleTextSearch`, and the internal `Query.hits` contract are now async and return promises.

If you call these APIs directly, update call sites to `await` the results.

## What Changed Since 0.9.1

### Async search and vector scoring

The main library change in `0.9.2` is that search execution now supports async query evaluation end-to-end. That enables vector scoring backends that need asynchronous execution while keeping the default CPU scorer available for synchronous and fallback use cases.

Related work in this area includes:

- async `DocumentIndex.search`, `searchRequest`, and `count`
- async `simpleTextSearch`
- async query execution across the query DSL
- exported vector scoring interfaces and params/options types from the package entrypoint
- new ANN and rerank tests covering async scorer behavior and hash-bit persistence

### Demo semantic-search improvements

The browser demo now attempts to use WebGPU for dense vector reranking and falls back automatically to the CPU path when WebGPU is unavailable or fails. The ask-the-docs UI also reports which backend is active.

To improve result stability on the current corpus size, semantic answer ranking now reranks the full loaded chunk set exactly instead of relying on ANN collisions for the final answer list.

### Docs and routing fixes

Supporting updates in this release include:

- docs/examples updated to the `VectorFieldIndex` params-object construction style where relevant
- semantic-search documentation refreshed to reflect the newer vector APIs
- a fix for section-link routing in ask-the-docs results, with a regression test covering the behavior

## Validation

Recommended release validation for this tag:

- `npm test`
- `npm run build --workspace @tryformation/querylight-ts`
- `npm pack --workspace @tryformation/querylight-ts --dry-run`
