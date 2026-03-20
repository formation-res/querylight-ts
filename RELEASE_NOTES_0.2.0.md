# Querylight TS 0.2.0

Querylight TS is a pure TypeScript in-memory search toolkit for browser and Node.js applications that need more than fuzzy matching but less than a full search server. Release `0.2.0` is the full release-line upgrade from `0.1.1`: it expands the query model, introduces a beginner-friendly search API, adds highlighting as a practical post-retrieval workflow, improves demo and browser-search ergonomics, strengthens validation, and reorganizes the internals to support future growth.

This release is intentionally broader than a small feature drop. Compared to `0.1.1`, it changes:

- how new users start with the library
- how browser search is documented and demonstrated
- how result explanation works through highlighting
- how expressive the query model is
- how bool queries behave in mixed hard/soft clause scenarios
- how much validation coverage exists around core ranking and retrieval behavior

## Executive summary

If you already use Querylight TS, the practical headline is:

- it is easier to get started quickly
- it is easier to build a browser search flow correctly
- it is easier to explain results to users
- it has a more complete set of search-engine-style query primitives
- it behaves more predictably if you are used to Elasticsearch/OpenSearch bool semantics

If you are new to the project, `0.2.0` is a better first release to adopt than `0.1.1` because the package now has a clearer onboarding path, better docs, more realistic examples, and better result presentation patterns.

## Release Scope Compared To 0.1.1

The diff from `0.1.1` to this release includes:

- new library features
- behavioral fixes
- new docs and onboarding material
- demo/search UX improvements
- internal modularization
- expanded correctness and regression coverage
- release/workflow alignment fixes

This means the release notes need to cover more than just the last few commits. The actual release scope includes the entire range from tag `0.1.1` to the current release prep state.

## Major user-facing additions

### Beginner search API for plain JSON documents

`0.2.0` adds a new beginner path:

- `createSimpleTextSearchIndex`
- `simpleTextSearch`

This is a meaningful change in product posture. Before this, Querylight TS had capable low-level primitives, but getting to a good search box still required manually composing analyzers, indexes, field boosts, fuzzy logic, and ranking fusion. That is fine for experienced search engineers, but it creates friction for the broader audience that wants a practical browser search feature quickly.

The beginner API now builds that default bundle for you:

- primary fields are indexed as the main lexical ranking signal
- secondary fields are indexed with lower lexical weight
- a dedicated suggest/prefix branch is created automatically
- a dedicated fuzzy branch based on ngrams is created automatically
- the lexical and fuzzy rankings are fused with reciprocal rank fusion
- quoted phrases are treated more strictly than unquoted input

This is not a toy wrapper. It is a usable default for:

- documentation sites
- content-heavy static sites
- browser apps with small to medium datasets
- demos and prototypes
- search experiences where “good default behavior” matters more than hand-tuned relevance

The important architectural detail is that the helper still exposes the underlying `DocumentIndex`. That keeps the beginner path from becoming a dead end. A team can start with `simpleTextSearch`, then later move to custom `BoolQuery`, field-specific analyzers, facets, vector search, or geo search without throwing away the indexed data model.

### Full browser-search getting-started path

`0.1.1` described the library. `0.2.0` does a much better job of showing how to use it in a real browser app.

The new documentation now walks through:

- building an index in Node.js
- serializing index state to JSON at build time
- shipping the serialized state with the site
- hydrating the index in the browser
- running queries client-side
- layering highlighting on top of retrieved hits

This matters because browser search is one of the main reasons this project exists. The library is now much clearer about the intended build-time/runtime split and about how to structure a practical implementation.

### Highlighting became a first-class workflow

One of the more important functional additions across the `0.1.1 -> 0.2.0` range is the introduction of post-retrieval highlighting on `DocumentIndex`.

The highlighter now:

- runs after retrieval instead of as part of ranking
- operates on stored source text
- returns fragments grouped by field
- includes exact source-relative offsets
- includes ready-to-render fragment parts

This is important because it moves Querylight TS beyond “retrieve ids and scores” into “retrieve and explain.” For browser search UIs, that is a meaningful capability change.

Practical uses include:

- highlighted titles in result lists
- explanation snippets such as “why this matched”
- short excerpts from body text
- side-by-side rendering of evidence in documentation or knowledge-base UIs

## Query model expansion

The query surface in `0.1.1` was already strong for a lightweight in-process library, but it had several low-cost omissions. `0.2.0` closes a number of those gaps.

### `PrefixQuery`

`PrefixQuery` exposes trie-backed prefix matching as a first-class query type.

That is useful because prefix behavior is common enough that it deserves to be explicit. While `MatchQuery` already had a `prefixMatch` option, this change improves query clarity and composition:

- autocomplete-style retrieval is more obvious in code
- prefix behavior can be mixed into bool queries without overloading `MatchQuery`
- the API looks more like what experienced search users expect from a search library

This is especially relevant for:

- search-as-you-type
- short-title navigation
- documentation browsers
- explicit query UIs where the query model itself is surfaced in code

### `TermsQuery`

`TermsQuery` adds exact any-of matching on a field.

This is a small feature with high practical value. In real search interfaces, users often filter on multiple selected values for the same field. Before this addition, callers would need to manually OR together several `TermQuery` instances. `TermsQuery` makes that intent direct and easier to read.

This helps with:

- multi-select tag filters
- section filters
- type/category filters
- exact facet interactions

### `ExistsQuery`

`ExistsQuery` filters documents that have at least one value for a field.

This is another small but common primitive in structured search systems. It becomes useful as soon as some metadata is optional.

Typical uses:

- only show documents with geo metadata
- only show records that have summaries or images
- split enriched records from sparse ones
- gate optional UI features off field presence

### `MultiMatchQuery`

`MultiMatchQuery` lets terms match across several fields instead of requiring one field to satisfy the full query on its own.

This is important because many document-search cases naturally distribute terms across fields. For example:

- one term in `title`
- one term in `tagline`
- one term in `body`

Without `MultiMatchQuery`, that pattern typically requires more manual bool composition. With it, the API becomes more concise and closer to how people think about document search:

- “search across title and body”
- “search headline, summary, and main text”
- “treat these fields as one conceptual full-text surface”

## Bool query semantics and behavior changes

One of the most important behavior changes in this release is the update to `BoolQuery`.

### Previous behavior

In the older behavior, `should` clauses could end up acting more like required clauses when mixed with `must` or `filter` clauses. That could unintentionally narrow result sets and make “soft preference” clauses behave like hidden hard constraints.

### New behavior in 0.2.0

`BoolQuery` now behaves more like users of Elasticsearch/OpenSearch-style bool queries would expect:

- `must` remains required
- `filter` remains required but is intended as non-scoring structure
- `mustNot` remains exclusion logic
- `should` contributes score by default
- when `must` or `filter` clauses are present, `should` is optional unless `minimumShouldMatch` says otherwise
- when the query contains only `should` clauses, at least one should clause must match

This is a meaningful behavioral correction, not just syntactic polish.

### Why this matters

This change improves both relevance tuning and developer predictability:

- “nice to have” signals stay nice to have
- documents that meet the hard requirements are no longer dropped because they missed a soft preference
- query composition reads more honestly
- users migrating mental models from Elasticsearch/OpenSearch will be less surprised

### `minimumShouldMatch`

`minimumShouldMatch` is now available directly on `BoolQuery`.

This gives callers a controlled middle ground between:

- purely optional `should` logic
- hard `must` logic

That enables patterns such as:

- require 2 of 3 preferred clauses
- require a minimum amount of soft evidence
- calibrate quality thresholds without over-constraining recall

### `mustNot` behavior also got attention in this release line

The full diff to `0.1.1` also includes a fix for `mustNot` exclusion semantics plus regression coverage. That matters because exclusion behavior is one of the easiest places for boolean logic to become subtly wrong.

## Highlighting improvements beyond the initial addition

The release line did not stop at introducing highlighting. It also improved what kinds of match evidence the highlighter can represent.

### Prefix highlighting

Prefix matches are now represented as first-class highlight spans. That makes prefix-driven interfaces easier to explain visually.

### Fuzzy highlighting

Approximate analyzer use cases, especially ngram-based matching, now surface fuzzy highlight evidence.

This is useful for:

- typo-tolerant search
- approximate matching in documentation search
- explaining why a fuzzy branch recovered a result

### Offset behavior with approximate analyzers

The implementation now works better when token filters are involved. The design tradeoff is still pragmatic:

- it highlights the containing token span
- it does not try to reconstruct the exact token-filter output as UI text

That is the right compromise for now, and it should be called out explicitly so users understand both the benefit and the current limitation.

## Demo and search UX improvements

The demo has changed meaningfully across this release range.

### Search behavior

Hybrid search behavior was improved and simplified:

- hybrid mode now fuses lexical and fuzzy branches using reciprocal rank fusion
- the fuzzy branch uses OR-style matching instead of a stricter AND-style behavior
- phrase handling in hybrid mode is better integrated
- prefix suggestions are gated more deliberately

This improves the demo’s realism and makes it a better representation of the library’s intended browser-search usage.

### Result explanation and presentation

The demo now uses highlighting to improve result explanation:

- highlighted titles in suggestion/result lists
- highlighted excerpt-like explanation snippets
- better presentation of why something matched

This is important because search quality is not just about scores. It is also about whether users can understand why a result appears.

### General polish

The demo also picked up:

- improved detail page behavior
- package and repository metadata in the UI
- build timestamp display
- cleaner homepage presentation
- footer metadata and project links

### Workflow fix for demo deployment

The Cloudflare Pages workflow was corrected to build the actual published package workspace instead of the old workspace name. That matters for release confidence because the demo pipeline now lines up with the real package identity.

## Serialization and hydration improvements

Serialization already existed as a capability, but `0.2.0` improves both the guidance and the confidence around it.

### Documentation improvements

The docs now more clearly present serialization as the recommended browser-search architecture:

1. collect content at build time
2. build indexes in Node.js
3. serialize to JSON
4. ship the JSON
5. hydrate in the browser

This positions Querylight TS not just as a search library, but as a practical in-browser retrieval system.

### Test coverage improvements

The release line adds serialization tests that specifically verify analyzer-based behavior survives round-tripping through saved state, including ngram-based matching after load. That matters because serialization bugs often only show up once analyzers or ranking config become more specialized.

## Test and correctness coverage expansion

One of the strongest differences between `0.1.1` and `0.2.0` is the increase in explicit correctness coverage.

### Algorithmic correctness tests

New tests now cover:

- `andHits`
- `orHits`
- reciprocal rank fusion scoring and tie-breaking
- reciprocal rank fusion parameter validation
- query context include/exclude behavior
- trie state reconstruction
- deterministic seeded randomness
- vector normalization and bigram vector consistency

These are not just feature tests. They protect the lower-level math and data-structure behavior that higher-level search behavior depends on.

### Geo algorithm tests

The release also adds targeted geo coverage for:

- polygon holes
- multipolygon intersection behavior
- geohash intersection rejection for disjoint bounds

This is useful because geo edge cases tend to be geometric rather than syntactic, and explicit tests are the best defense against regressions.

### Simple search tests

The beginner API also ships with dedicated coverage for:

- invalid ids
- unsupported field types
- primary-vs-secondary ranking expectations
- prefix behavior
- typo recovery
- quoted query handling
- pagination behavior

### Query and highlighting tests

The new query primitives and highlighting behavior are covered as well:

- `PrefixQuery`
- `TermsQuery`
- `ExistsQuery`
- `MultiMatchQuery`
- updated `BoolQuery` behavior
- `minimumShouldMatch`
- fuzzy highlighting for ngram analyzers

## Internal modularization and maintainability work

This release also substantially reorganizes the implementation internals.

The codebase now has a cleaner split between:

- document indexing
- query types
- shared/public types
- vector functionality
- query helper plumbing
- simple-search convenience logic

Notable refactoring themes in the release line include:

- extracting vector logic from the main entrypoint implementation
- extracting ranking strategies
- decoupling document indexing from concrete field-index implementations
- centralizing shared query helpers and public types
- making the library entrypoint a cleaner export surface rather than the place where all logic lives

This is mostly internal, but it matters because it:

- reduces feature-coupling
- improves readability
- makes future additions easier to implement
- lowers the maintenance burden of a growing API surface

## Documentation improvements

The docs and README changed substantially between `0.1.1` and `0.2.0`.

### README

The README now includes:

- npm/version and build badges
- direct demo link
- clearer feature summary
- beginner-path example
- highlighting example
- stronger project positioning

### New docs added in this release line

- simple text search guide
- browser getting-started guide
- highlighting guide

### Updated docs

- overview
- term/match query docs
- bool query docs
- serialization docs

This matters because the release does not just add capabilities. It also makes them discoverable.

## Upgrade notes

### Bool behavior changed

If you relied on the previous behavior where `should` clauses effectively acted as required clauses when combined with `must` or `filter`, review those queries before release rollout.

If you want the old “soft clauses become effectively required” effect intentionally, use `minimumShouldMatch` to express it directly.

### Highlight span kinds expanded

If your UI code branches on highlight span kinds, note that spans can now be:

- `exact`
- `phrase`
- `prefix`
- `fuzzy`

### This release is additive, but not purely additive

There are no obvious package-name or top-level install breaks here, but this is not a zero-behavior-change release either. The main area to review is bool semantics. Result ordering and inclusion can change if your queries previously depended on the older `should` behavior.

## Release preparation and validation status

For the current `0.2.0` prep state, the following checks were run locally:

- `npm test`
- `npm run build --workspace @tryformation/querylight-ts`
- `npm pack --workspace @tryformation/querylight-ts --dry-run`

All of those passed after fixing one DTS issue that the build surfaced in `MultiMatchQuery.highlightClauses` during release prep.

Registry check at prep time:

- current npm `latest`: `0.1.1`
- planned next version: `0.2.0`

## Diff-based release scope

Compared against tag `0.1.1`, the release line includes these particularly relevant commits:

- `a0d56ab` Add beginner search API and getting-started docs
- `0ea735d` Add offset-based highlighting and demo support
- `2eb5c4d` Add `PrefixQuery`
- `d24a105` Improve `BoolQuery` should semantics
- `9c433e9` Add `TermsQuery`
- `f01986c` Add `ExistsQuery`
- `0b3c9f8` Add `MultiMatchQuery`
- `d3dce33` Improve fuzzy highlighting
- `af6f406` Add algorithmic correctness coverage
- `1cc8cda` Fix bool `mustNot` exclusion semantics
- `9841a05` Improve hybrid search
- `f5b14fb` Split index, queries, and field indexes into modules
- `d05e7ef` Extract vector module from library entrypoint
- `20910e8` Fix demo search mode behavior
- `b1006f6` Simplify demo detail page
- `a7f4d1b` Add demo footer metadata links
- `e6ae074` Fix demo deploy workspace name
- `f4988d8` Update query and highlighting docs

Additional commits in the range cover supporting docs, metadata, and release-preparation improvements.

## Links

- Demo: https://querylight-ts-demo.pages.dev
- npm package: https://www.npmjs.com/package/@tryformation/querylight-ts
- Repository: https://github.com/formation-res/querylight-ts
