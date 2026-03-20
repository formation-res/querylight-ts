---
id: relevance-tuning
section: Ranking
title: Relevance Tuning with BM25, TF-IDF, and RRF
summary: Choose ranking strategies deliberately and combine result lists when one signal is not enough.
tags: [ranking, bm25, tfidf, rrf, relevance, tuning]
apis: [RankingAlgorithm, defaultBm25Config, reciprocalRankFusion, MatchQuery, VectorFieldIndex]
level: advanced
order: "24"
---

# Relevance Tuning with BM25, TF-IDF, and RRF

Good search is not just about matching documents. It is about ordering them well.

Querylight TS gives you three useful tools for that:

- TF-IDF for classic term weighting
- BM25 for stronger length normalization and more modern lexical ranking
- reciprocal rank fusion for combining different ranked lists

## When to prefer BM25

BM25 is usually the better default for full-text search over titles, summaries, and bodies.

It tends to behave better when:

- document lengths vary a lot
- query terms repeat unevenly
- you want more Lucene-like lexical scoring

## When TF-IDF is still useful

TF-IDF is simpler and sometimes easier to reason about for small corpora or experiments. If your documents are short and fairly uniform, the difference may not be dramatic.

## Ranking is field-sensitive

Not every field should contribute equally.

- `title` usually deserves stronger influence
- `body` provides recall
- `tags` and `section` often work better as filters than scoring drivers

That is why schema design and ranking design are tightly connected.

## Use RRF when signals disagree

Sometimes you have more than one retrieval strategy:

- lexical search over text
- typo recovery over ngrams
- vector similarity
- geo or filtered candidate lists

Those scores are not directly comparable. `reciprocalRankFusion` solves that by combining rank positions instead of raw scores.

## A practical hybrid pattern

1. run a lexical query over `title` and `body`
2. run a fuzzy query over an ngram field
3. optionally run vector retrieval
4. fuse the ranked lists with RRF

This often produces better top results than trying to force all behavior into one query.

## Tuning questions to ask

When results feel wrong, check:

- Is the field design right?
- Is the query too broad?
- Is one field dominating too much?
- Should this signal be fused separately instead?

## Keep tuning empirical

Do not guess from theory alone. Collect representative queries and inspect:

- the top 5 results
- where obvious results land
- whether short exact matches are being buried
- whether fuzzy/vector behavior introduces noise

Relevance tuning is iterative. Stable schemas and realistic test queries matter more than clever scoring tricks.
