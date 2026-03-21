# Querylight TS 0.9.0

Querylight TS is a pure TypeScript in-memory search toolkit for browser and Node.js applications that need more than fuzzy matching but less than a full search server. Release `0.9.0` is a major step up from `0.2.0`: it broadens the query and ranking model, adds structured discovery features such as numeric/date aggregations, strengthens hybrid and semantic retrieval, expands the documentation into a much more complete product surface, and completely overhauls the demo into a richer documentation search application.

Links:

- Demo: [https://querylight-ts-demo.pages.dev](https://querylight-ts-demo.pages.dev)
- npm package: [https://www.npmjs.com/package/@tryformation/querylight-ts](https://www.npmjs.com/package/@tryformation/querylight-ts)
- Repository: [https://github.com/formation-res/querylight-ts](https://github.com/formation-res/querylight-ts)

## Executive Summary

This release is intentionally much bigger than a routine minor version bump.

Compared to `0.2.0`, Querylight TS now offers:

- a broader search-engine-style query surface, including best-field, soft-boosting, wildcard, regex, script, rank-feature, and distance-feature querying
- much stronger hybrid retrieval patterns, including vector rescoring on top of lexical candidates
- structured discovery primitives beyond term counts, especially numeric and date aggregations
- clearer positioning as a browser-first search toolkit that combines lexical, semantic, vector, geo, and faceted search patterns in one local package
- a much larger and more cohesive documentation set, including guides, discovery articles, ranking articles, operational guidance, and demo internals
- a substantially redesigned demo that now feels closer to a real documentation search application than a small showcase page

If `0.2.0` established Querylight TS as a capable in-process search library, `0.9.0` makes a stronger case for it as a practical platform for building serious browser and static-site search experiences.

## Release Scope

The diff from tag `0.2.0` to this release includes:

- major library feature additions
- new ranking and retrieval options
- new numeric/date indexing and aggregation support
- a large documentation expansion and reorganization
- a full demo overhaul, including semantic search, faceted navigation, richer result views, and better information architecture
- expanded automated test coverage

This release contains roughly:

- 80+ changed files
- nearly 8,000 added lines across code, docs, tests, and demo assets

## Library Features By Area

### 1. Advanced lexical and structured querying

The query model is substantially broader in `0.9.0`.

Newly added or now prominently supported query capabilities include:

- `MultiMatchQuery` for searching across multiple fields as one conceptual text surface
- `DisMaxQuery` for best-field scoring patterns
- `BoostingQuery` for soft demotion instead of hard exclusion
- `WildcardQuery` and `RegexpQuery` for pattern-driven term lookup
- `ScriptQuery` for custom JavaScript filtering logic
- `ScriptScoreQuery` for custom JavaScript scoring logic
- `RankFeatureQuery` for numeric relevance signals
- `DistanceFeatureQuery` for recency/closeness-style boosts
- improved `BoolQuery` behavior and more predictable `minimumShouldMatch` semantics

Why this matters:

- the library now supports a much more realistic slice of search-engine-style relevance tuning
- callers can express soft preferences, best-field ranking, structured filters, and custom scoring without having to leave the in-memory model
- browser-side search flows can now model more than a simple match-or-no-match search box

### 2. Discovery and faceting got much stronger

One of the biggest capability jumps in this release is the move from simple term-oriented discovery to broader structured analytics.

New or expanded discovery features include:

- numeric field indexing
- date field indexing
- `sum`, `min`, `max`, `avg`, `stats`, and `valueCount` aggregations
- `rangeAggregation(...)` for stable human-defined buckets
- `histogram(...)` for numeric/date distribution views
- `dateHistogram(...)` for time-oriented exploration
- improved documentation and examples around terms aggregation and significant terms

Practical impact:

- Querylight TS can now support richer faceted navigation and discovery workflows
- result pages can expose counts, distributions, and bounded drill-downs instead of just flat hit lists
- browser apps can build dashboard-like search experiences without introducing a separate analytics backend

### 3. Hybrid and semantic retrieval matured

`0.9.0` makes semantic and hybrid retrieval more usable in practice, not just possible in principle.

The release adds or expands:

- vector rescoring with `VectorRescoreQuery`
- clearer separation between lexical candidate generation and vector-based reranking
- more documentation around approximate nearest-neighbour search and hybrid search tradeoffs
- better patterns for chunk-based semantic retrieval in docs-style corpora

Why this matters:

- hybrid retrieval no longer has to mean "run vector search over everything first"
- the library can support a more efficient lexical-first, semantic-second flow
- documentation, content, and recommendation experiences can stay local while still benefiting from embeddings

### 4. Browser-shipped search architecture is better documented and easier to adopt

The project now does a better job of explaining how to use Querylight TS in the environment it was clearly built for: static sites, browser apps, and build-time generated search payloads.

This release strengthens patterns around:

- JSON-serializable index state
- build-time index generation
- browser-side hydration
- shipped documentation corpora
- chunking strategies for semantic retrieval
- performance and memory tradeoffs
- testing search behavior and tuning relevance over time

This is important because the main challenge in client-side search is usually not indexing a toy dataset. It is designing a robust build-time/runtime workflow. `0.9.0` gives users a much more complete path for doing that correctly.

### 5. Highlighting and result explanation remain part of the core story

Highlighting was introduced earlier, but this release keeps result explanation as a first-class part of the overall product story through improved docs and demo usage.

The practical takeaway is that Querylight TS now presents retrieval and explanation together:

- retrieve ids and scores
- derive snippets and match evidence
- combine search, filtering, and explanation in one browser-shippable flow

That makes the project easier to evaluate as a complete search UI toolkit rather than only a ranking library.

## Demo Overhaul

The demo changed dramatically in this release line. It is no longer just a minimal browser example. It has become a richer, more realistic documentation-search application that demonstrates both the library surface and the architectural patterns behind it.

### 1. "Ask the Docs" semantic search experience

The headline demo addition is a full semantic question-answering style flow for documentation search.

The demo now:

- precomputes documentation embeddings at build time
- splits articles into heading-aware chunks for semantic retrieval
- ships the embedding payload with the static app
- lazily loads the transformer pipeline in the browser
- embeds the user query locally
- matches that query against chunk embeddings to recover semantically relevant answers

This is a meaningful product milestone because it shows that Querylight TS can power a fully local semantic documentation experience without introducing a vector database or hosted search API.

### 2. Related docs and chunk deeplinks

The semantic work is not limited to question answering.

The demo also now supports:

- related-document discovery
- semantic chunk deeplinks
- tighter mapping between semantic hits and visible documentation sections

That improves both usability and credibility. Instead of showing semantic scores in isolation, the demo turns them into navigable reading paths.

### 3. Faceted navigation and discovery sidebar

The right-hand sidebar is now a real discovery interface rather than decorative chrome.

It exposes:

- tag facets
- section facets
- API-name facets
- significant terms
- numeric article-length buckets
- compact numeric distribution views

This is important for two reasons:

- it demonstrates that Querylight TS supports filter-heavy exploratory browsing, not just free-text lookup
- it gives users a direct example of how aggregations, range filters, and significant terms work together in an actual UI

### 4. Better search-state handling and result presentation

The demo’s lexical and hybrid flows have been improved so the app behaves more like a polished search product.

Changes across this release line include:

- improved mode switching
- better Enter-key behavior in Ask the Docs
- a semantic-search busy/loading overlay
- better handling of search state, filters, and result rendering
- richer result and navigation affordances around docs content

The net effect is that the demo now better communicates intended usage patterns instead of feeling like a thin test harness.

### 5. Build pipeline improvements

The demo build process now does substantially more work for the user:

- it reads and parses the docs corpus
- derives metadata used for lexical indexing and faceting
- computes semantic embeddings
- generates app-ready JSON payloads
- integrates the generated content into Vite builds and dev mode

That makes the demo a useful reference architecture for static documentation search, not just a feature showcase.

## Documentation Expansion And Repositioning

The documentation set was heavily expanded and reorganized for this release.

New or substantially improved areas include:

- overview and positioning material
- browser search onboarding
- schema design guidance
- analyzers/tokenization deep dives
- autocomplete and faceted-navigation guides
- relevance tuning guides
- numeric/date indexing and aggregation articles
- wildcard, regex, script, boosting, and dis-max query documentation
- vector rescoring and semantic retrieval patterns
- operational guidance on performance, memory, and testing
- demo-internals writeups explaining how the app works end to end

This is more than a docs quantity increase. It changes how approachable the project is:

- new users get clearer positioning and onboarding
- intermediate users get concrete recipes
- advanced users get lower-level articles on scoring, discovery, and architecture

For a library with this many features, that documentation expansion is itself a release headline.

## Developer Experience And Reliability

This release also improves project quality around validation and maintenance.

Notable improvements include:

- expanded automated coverage for advanced query behavior
- dedicated tests for numeric aggregations
- stronger regression coverage around serialization and query semantics
- continued modularization of the internals

That matters because the project is now broad enough that release confidence depends on good behavioral coverage, not just feature breadth.

## Why The Version Jumps To 0.9.0

The move from `0.2.0` to `0.9.0` is intentional.

This release represents:

- a substantial expansion of the public capability surface
- a clearer and more mature product story
- a more complete hybrid/semantic/discovery toolkit
- a demo that now showcases an end-to-end application rather than isolated features
- documentation breadth that is much closer to what users expect from a serious library

It is still a pre-`1.0` project, but it is no longer at the same stage of maturity as the `0.2.x` line.

## Upgrade Notes

Users upgrading from `0.2.0` should review:

- the expanded query surface, especially if they want to simplify custom bool/query compositions
- the new numeric/date indexing and aggregation APIs for discovery-heavy UIs
- the semantic and vector rescoring docs if they are building hybrid retrieval
- the reorganized documentation index for updated guidance and examples

If you only used Querylight TS as a simple lexical search library before, `0.9.0` gives you a much larger toolbox without requiring a backend search service.

## Validation Checklist For This Release Prep

Before tagging `0.9.0`, the repository should still complete the standard release validations:

- `npm test`
- `npm run build --workspace @tryformation/querylight-ts`
- `npm pack --workspace @tryformation/querylight-ts --dry-run`

The release should only be tagged after the release-prep commit is pushed and branch CI is green for that exact commit SHA.
