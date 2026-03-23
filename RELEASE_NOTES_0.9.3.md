# Querylight TS 0.9.3

Querylight TS is a pure TypeScript in-memory search toolkit for browser and Node.js applications that combines lexical, vector, geo, faceted, and analytics-style search patterns in one local package.

This patch release fixes boolean query semantics so required clauses behave correctly when they match nothing, and it aligns the demo's `AND` search mode with that stricter behavior.

Links:

- Demo: [https://querylight.tryformation.com/](https://querylight.tryformation.com/)
- npm package: [https://www.npmjs.com/package/@tryformation/querylight-ts](https://www.npmjs.com/package/@tryformation/querylight-ts)
- Repository: [https://github.com/formation-res/querylight-ts](https://github.com/formation-res/querylight-ts)

## Highlights

- fixes `BoolQuery` so `must` clauses no longer fall back to `should` hits when the required match set is empty
- adds a library regression test covering that required-clause behavior
- updates the demo docs-search query builder to enforce cross-field `AND` semantics consistently
- adds an end-to-end regression test for demo `AND` mode with a two-term query that should produce zero matches

## Validation

Recommended release validation for this tag:

- `npm test`
- `npm run build --workspace @tryformation/querylight-ts`
- `npm pack --workspace @tryformation/querylight-ts --dry-run`
