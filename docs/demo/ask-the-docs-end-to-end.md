---
id: ask-the-docs
section: Demo Internals
title: Ask the Docs End to End
summary: How the demo builds lexical, sparse, and dense retrieval assets, ships them to the browser, and answers natural-language questions locally.
tags: [demo, semantic-search, sparse-search, embeddings, transformers, browser, github-actions]
apis: [VectorFieldIndex, SparseVectorFieldIndex, cosineSimilarity, FeatureExtractionPipeline]
level: advanced
order: 10
---

# Ask the Docs End to End

The demo has three retrieval experiences:

- regular lexical search
- sparse search based on OpenSearch-style token-weight vectors
- dense ANN search and "Ask the Docs", which turn a query into an embedding and match it against precomputed vectors

This article explains how those assets are built and how the dense semantic path reaches in-browser answers.

## Short introduction: what embeddings are

An embedding is a vector: a long array of numbers that represents the meaning of a text.

You can think of it like this:

- text goes into a model
- the model outputs numbers
- similar texts produce vectors that are close together

That lets you ask a question such as `how do I preload search indexes in the browser?` and still retrieve an article that mostly talks about build-time serialization and hydration, even if it does not use your exact wording.

## The model used in the demo

The demo uses [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2).

Why this model is a practical choice here:

- it is small enough to run in the browser
- it is available through `@huggingface/transformers`
- it produces useful sentence-level embeddings for short docs and chunked paragraphs

The semantic metadata lives in the demo source here:

- [apps/demo/src/semantic.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/semantic.ts)

That file defines:

- the model id
- chunk sizing constants
- markdown cleanup helpers
- article and chunk payload types used by both the build step and the browser runtime

## Build-time flow

The build step reads all markdown docs, extracts metadata, builds lexical indexes, precomputes sparse document vectors, and precomputes dense semantic embeddings.

Relevant source:

- [apps/demo/build/demo-data.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/build/demo-data.ts)
- [apps/demo/vite.config.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/vite.config.ts)

The high-level flow is:

1. Read every file in [`docs/`](https://github.com/formation-res/querylight-ts/tree/main/docs).
2. Parse frontmatter and markdown into `DocEntry` records.
3. Turn each article into one sparse document text and one dense semantic article text.
4. Split each article into heading-aware chunks for dense semantic answers.
5. Run the sparse document encoder over each article.
6. Run the dense embedding model over each article text and chunk.
7. Store those retrieval assets in generated demo JSON.
8. Bundle that JSON into the demo app.

The Vite plugin in [`apps/demo/vite.config.ts`](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/vite.config.ts) runs this automatically:

- during local development
- during production builds
- when markdown docs change in dev mode

## Why the docs are chunked

Whole-page dense embeddings are useful for ANN article retrieval and related-article suggestions, but question answering works better when you search smaller pieces.

The demo therefore creates:

- sparse document vectors, used for the dedicated sparse search mode
- article embeddings, used for related articles
- article embeddings, used for the dedicated ANN search mode
- chunk embeddings, used for Ask the Docs answers

Chunks are built from heading sections and grouped paragraphs. That preserves enough structure to show a useful answer snippet while keeping each vector focused on one topic.

## Browser-time flow

When a user runs dense semantic retrieval:

1. The browser lazily loads the transformer pipeline.
2. The query is embedded locally in the browser.
3. The article embedding index reranks the candidate documents.

When a user switches to "Ask the Docs" and submits a question:

1. The browser lazily loads the transformer pipeline.
2. The question is embedded locally in the browser.
3. The query vector is compared to the precomputed chunk vectors.
4. The best-matching chunks are mapped back to documentation pages.
5. The UI shows the chunk text as the answer preview.

Relevant source:

- [apps/demo/src/main.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/main.ts)
- [apps/demo/src/semantic.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/semantic.ts)
- [apps/demo/src/sparse.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/sparse.ts)

In the runtime code, look for:

- `encodeSparseQuery(...)`: creates the sparse query vector from tokenizer ids and learned query token weights
- `createSparseRuntime(...)`: loads precomputed sparse document vectors into a `SparseVectorFieldIndex`
- `embedSemanticQuery(...)`: runs the embedding model in the browser
- `createSemanticRuntime(...)`: loads precomputed chunk vectors into a `VectorFieldIndex`
- `articleIndex`: reranks article-level dense candidates for ANN search mode
- `getSemanticQuestionResults(...)`: maps nearest chunk hits back to docs
- `renderAskResultsPage(...)`: renders the semantic matches

## Running the model in the browser and in GitHub Actions

This demo intentionally uses two model families in the browser:

- sparse query encoding based on tokenizer ids plus learned query token weights
- dense semantic embeddings for ANN search and Ask the Docs

That gives you three local retrieval modes from one static site:

- lexical search over prebuilt text indexes
- sparse search over prebuilt token-weight maps
- dense retrieval over prebuilt article and chunk embeddings

The CI workflow builds the demo on GitHub Actions:

- [.github/workflows/ci-demo-deploy.yml](https://github.com/formation-res/querylight-ts/blob/main/.github/workflows/ci-demo-deploy.yml)

During `npm run build --workspace @querylight/demo`, the demo-data build code runs, which means GitHub Actions can pre-calculate embeddings as part of the site build before deploying the static app.

## Expected behavior

A lexical search for `serialize index state`, a sparse search for `prebuilt browser index`, and an Ask the Docs question like `How do I build the index ahead of time and load it in the browser later?` may all lead you to the same article, but they get there differently:

- lexical search depends on matching the actual terms
- sparse search depends on learned token expansions and token-weight overlap
- Ask the Docs depends on semantic closeness between the question vector and the chunk vectors

That is why Ask the Docs can recover pages even when the wording is less exact.

## Trade-offs

This design is simple and practical, but it is not magic:

- the first semantic query pays the cost of loading the model in the browser
- the first sparse query pays the cost of loading the tokenizer in the browser
- embeddings increase build time
- sparse vectors and embeddings also increase the size of generated demo data
- semantic retrieval is approximate and should still be evaluated against real questions

For a documentation demo, those trade-offs are reasonable because the architecture stays fully static and easy to deploy.
