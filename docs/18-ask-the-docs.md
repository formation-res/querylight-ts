---
id: ask-the-docs
section: Advanced
title: Ask the Docs End to End
summary: How the demo builds semantic embeddings, ships them to the browser, and answers natural-language questions locally.
tags: [demo, semantic-search, embeddings, transformers, browser, github-actions]
apis: [VectorFieldIndex, cosineSimilarity, FeatureExtractionPipeline]
level: advanced
order: "18"
---

# Ask the Docs End to End

The demo has two retrieval experiences:

- regular search, which is mostly lexical
- "Ask the Docs", which turns a question into an embedding and matches it against precomputed documentation chunks

This article explains the semantic path from markdown files to in-browser answers.

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

The build step reads all markdown docs, extracts metadata, builds lexical indexes, and precomputes semantic embeddings.

Relevant source:

- [apps/demo/build/demo-data.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/build/demo-data.ts)
- [apps/demo/vite.config.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/vite.config.ts)

The high-level flow is:

1. Read every file in [`docs/`](https://github.com/formation-res/querylight-ts/tree/main/docs).
2. Parse frontmatter and markdown into `DocEntry` records.
3. Turn each article into one article-level semantic text.
4. Split each article into heading-aware chunks.
5. Run the embedding model over the article text and each chunk.
6. Store the vectors in generated demo JSON.
7. Bundle that JSON into the demo app.

The Vite plugin in [`apps/demo/vite.config.ts`](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/vite.config.ts) runs this automatically:

- during local development
- during production builds
- when markdown docs change in dev mode

## Why the docs are chunked

Whole-page embeddings are useful for related-article suggestions, but question answering works better when you search smaller pieces.

The demo therefore creates:

- article embeddings, used for related articles
- chunk embeddings, used for Ask the Docs answers

Chunks are built from heading sections and grouped paragraphs. That preserves enough structure to show a useful answer snippet while keeping each vector focused on one topic.

## Browser-time flow

When a user switches to "Ask the Docs" and submits a question:

1. The browser lazily loads the transformer pipeline.
2. The question is embedded locally in the browser.
3. The query vector is compared to the precomputed chunk vectors.
4. The best-matching chunks are mapped back to documentation pages.
5. The UI shows the chunk text as the answer preview.

Relevant source:

- [apps/demo/src/main.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/main.ts)
- [apps/demo/src/semantic.ts](https://github.com/formation-res/querylight-ts/blob/main/apps/demo/src/semantic.ts)

In the runtime code, look for:

- `embedSemanticQuery(...)`: runs the embedding model in the browser
- `createSemanticRuntime(...)`: loads precomputed chunk vectors into a `VectorFieldIndex`
- `getSemanticQuestionResults(...)`: maps nearest chunk hits back to docs
- `renderAskResultsPage(...)`: renders the semantic matches

## Running the model in the browser and in GitHub Actions

This demo intentionally uses the same model family in two places:

- at build time in Node.js to precompute embeddings for all docs
- in the browser to embed the user’s question on demand

That gives you a fully local semantic experience:

- the browser does not need a search backend
- the shipped vectors are already ready to query
- only the question embedding needs to be computed at interaction time

The CI workflow builds the demo on GitHub Actions:

- [.github/workflows/ci-demo-deploy.yml](https://github.com/formation-res/querylight-ts/blob/main/.github/workflows/ci-demo-deploy.yml)

During `npm run build --workspace @querylight/demo`, the demo-data build code runs, which means GitHub Actions can pre-calculate embeddings as part of the site build before deploying the static app.

## Expected behavior

A lexical search for `serialize index state` and an Ask the Docs question like `How do I build the index ahead of time and load it in the browser later?` may both lead you to the same article, but they get there differently:

- lexical search depends on matching the actual terms
- Ask the Docs depends on semantic closeness between the question vector and the chunk vectors

That is why Ask the Docs can recover pages even when the wording is less exact.

## Trade-offs

This design is simple and practical, but it is not magic:

- the first semantic query pays the cost of loading the model in the browser
- embeddings increase build time
- embeddings also increase the size of generated demo data
- semantic retrieval is approximate and should still be evaluated against real questions

For a documentation demo, those trade-offs are reasonable because the architecture stays fully static and easy to deploy.
