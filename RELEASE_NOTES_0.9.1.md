# Querylight TS 0.9.1

Querylight TS is a pure TypeScript in-memory search toolkit for browser and Node.js applications that combines lexical, vector, geo, faceted, and analytics-style search patterns in one local package.

This release focuses on the API surface cleanup that landed after `0.9.0`, plus documentation and demo work that make the library easier to adopt and evaluate.

Links:

- Demo: [https://querylight.tryformation.com/](https://querylight.tryformation.com/)
- npm package: [https://www.npmjs.com/package/@tryformation/querylight-ts](https://www.npmjs.com/package/@tryformation/querylight-ts)
- Repository: [https://github.com/formation-res/querylight-ts](https://github.com/formation-res/querylight-ts)

## Highlights

- refactors the query DSL toward value-object parameters instead of positional multi-argument APIs
- adds TSDoc coverage for the exported public API surface
- expands the generated API reference content in the demo and documentation site
- promotes significant terms as a first-class aggregation concept in docs and tests
- improves trie-backed prefix query documentation and related search guidance
- refreshes dependencies and supporting workflow/docs maintenance

## API Compatibility Note

This release includes API changes, but the project is intentionally staying on the `0.9.x` line until the broader surface is considered ready for `1.0.0`.

Treat `0.9.x` as an active pre-`1.0` stabilization series: compatibility may still evolve, and breaking cleanup is still allowed while the package converges on the final `1.0` shape.

## What Changed Since 0.9.0

### Query API cleanup

The largest library-facing change in this release is the refactor of the query DSL to prefer value-object parameters. That makes call sites clearer, reduces ambiguity in multi-argument constructors/helpers, and sets a more stable direction for the eventual `1.0` API.

Related work in this area includes:

- public API TSDoc across exported declarations
- shared public-type cleanup
- query and document-index adjustments to support the new call patterns
- test updates around bool, query, range, ranking, serialization, geo, and significant-terms behavior

### Documentation and demo improvements

The release also improves how the project explains and presents its surface area:

- searchable API reference docs were added to the site build
- significant terms docs were rewritten and elevated
- several discovery, ranking, lexical-querying, and positioning articles were clarified
- the demo dashboard and Hugo-backed site build were expanded so the docs experience reflects the newer API/documentation structure more accurately

### Maintenance

Additional release-scope work includes:

- dependency updates
- workflow maintenance for CI/demo deploy support
- repository skill/docs maintenance used for contributor guardrails

## Validation

Recommended release validation for this tag:

- `npm test`
- `npm run build --workspace @tryformation/querylight-ts`
- `npm pack --workspace @tryformation/querylight-ts --dry-run`
