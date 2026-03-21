---
id: document-chunking-strategies
section: Other Features
title: Document Chunking Strategies
summary: Split long documents into meaningful sections so lexical retrieval, highlighting, and vector search stay focused.
tags: [chunking, vector, semantic-search, highlighting, retrieval]
apis: [VectorFieldIndex, cosineSimilarity, DocumentIndex]
level: advanced
order: 50
---

# Document Chunking Strategies

Long documents often contain multiple topics. Treating the whole page as one retrieval unit can make both lexical and semantic search less precise.

Chunking solves that by breaking a document into smaller sections that still preserve enough context to be useful.

## Why chunking helps

Chunking improves retrieval when:

- one page covers several subtopics
- users ask narrow questions
- you want answer-like snippets instead of page-level matches
- you want semantic search to focus on one idea at a time

This is especially important for vector search, where whole-page embeddings can blur several concepts together.

## Good chunk boundaries

Useful chunk boundaries usually come from document structure:

- headings
- subheadings
- short paragraph groups
- code-example sections

Those boundaries are better than slicing purely by character count because they preserve meaning.

## Chunk size tradeoffs

Small chunks:

- improve precision
- make snippet rendering easier
- can lose context if made too small

Large chunks:

- preserve more context
- can become semantically mixed
- may reduce answer quality for focused questions

In practice, heading-aware paragraph groups are a good default.

## Preserve document identity

A chunk should keep links back to:

- the parent document id
- its heading path
- the text used for display

That lets you retrieve at chunk level but still render page-level navigation cleanly.

## Lexical and vector chunking can differ

You do not need one universal chunk strategy.

- lexical search may work fine at page level for some corpora
- semantic question answering often benefits from paragraph-scale chunks

Use smaller units where precision matters most.

## Good metadata for chunked corpora

Add stable metadata around chunks:

- document title
- section
- heading path
- parent document id

That context is useful both for ranking interpretation and for LLM-friendly downstream use.

## A practical default

For documentation:

1. split by headings
2. group a few related paragraphs together
3. keep code blocks with the section they explain
4. retain links back to the source page

That is usually enough to make vector retrieval and answer previews much more useful.
