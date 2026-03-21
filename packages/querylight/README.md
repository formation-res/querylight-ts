# @tryformation/querylight-ts

Lightweight in-memory search for TypeScript applications.

`@tryformation/querylight-ts` combines structured indexing, BM25/TF-IDF ranking, boolean queries, aggregations, vector search, hybrid reranking, geo search, and offset-based highlighting in one small API for browser and Node.js projects.

In practice, this is an easy way to add semantic-search features locally without introducing a separate search server or vector database. You can use it for "Ask the Docs" search, related articles, semantic reranking, typo-tolerant content discovery, faceted navigation, and geo-aware retrieval.

It is one of the few browser-first TypeScript search toolkits that combines structured search-engine-style querying and lightweight vector search in the same local package.

For the full project README, examples, and all documentation, see:

- Full project README: [https://github.com/formation-res/querylight-ts/blob/main/README.md](https://github.com/formation-res/querylight-ts/blob/main/README.md)
- Documentation index: [https://github.com/formation-res/querylight-ts/blob/main/docs/index.md](https://github.com/formation-res/querylight-ts/blob/main/docs/index.md)

## Use Cases

- Docs and site search: BM25 ranking, `MatchQuery`, `MultiMatchQuery`, highlighting, and serialized indexes.
- Semantic "Ask the Docs": vector indexing, chunk retrieval, and lexical-first vector reranking.
- Related articles and recommendations: vector similarity over documents or chunks.
- Faceted discovery and filtered search: `BoolQuery`, aggregations, terms filters, and significant terms.
- Product or catalog search: fielded search, hard filters, prefixes, and hybrid retrieval patterns.
- Typo-tolerant search: ngram analyzers, prefix search, and `bigramVector`.
- Geo-aware search: point and polygon queries over GeoJSON fields.

## Install

```bash
npm install @tryformation/querylight-ts
```

## Demo

- Cloudflare demo: [https://querylight.tryformation.com/](https://querylight.tryformation.com/)

The demo site also includes the most comprehensive documentation set for the project and showcases the "Ask the Docs" vector-search experience over that documentation corpus.

## Repository

- Source: [https://github.com/formation-res/querylight-ts](https://github.com/formation-res/querylight-ts)
- Full README: [https://github.com/formation-res/querylight-ts/blob/main/README.md](https://github.com/formation-res/querylight-ts/blob/main/README.md)

## Documentation

- Documentation index: [https://github.com/formation-res/querylight-ts/blob/main/docs/index.md](https://github.com/formation-res/querylight-ts/blob/main/docs/index.md)
- Introduction: [https://github.com/formation-res/querylight-ts/blob/main/docs/overview/introduction.md](https://github.com/formation-res/querylight-ts/blob/main/docs/overview/introduction.md)
- Overview: [https://github.com/formation-res/querylight-ts/blob/main/docs/overview/what-querylight-ts-covers.md](https://github.com/formation-res/querylight-ts/blob/main/docs/overview/what-querylight-ts-covers.md)
- Getting started: [https://github.com/formation-res/querylight-ts/blob/main/docs/overview/getting-started-with-browser-search.md](https://github.com/formation-res/querylight-ts/blob/main/docs/overview/getting-started-with-browser-search.md)
- Highlighting: [https://github.com/formation-res/querylight-ts/blob/main/docs/features/highlighting-with-querylight-ts.md](https://github.com/formation-res/querylight-ts/blob/main/docs/features/highlighting-with-querylight-ts.md)
- Vector search: [https://github.com/formation-res/querylight-ts/blob/main/docs/features/approximate-nearest-neighbor-vector-search.md](https://github.com/formation-res/querylight-ts/blob/main/docs/features/approximate-nearest-neighbor-vector-search.md)
- Vector rescoring: [https://github.com/formation-res/querylight-ts/blob/main/docs/features/vector-rescoring-for-faster-hybrid-search.md](https://github.com/formation-res/querylight-ts/blob/main/docs/features/vector-rescoring-for-faster-hybrid-search.md)
- Comparison with other browser search libraries: [https://github.com/formation-res/querylight-ts/blob/main/docs/overview/browser-search-library-comparison.md](https://github.com/formation-res/querylight-ts/blob/main/docs/overview/browser-search-library-comparison.md)
