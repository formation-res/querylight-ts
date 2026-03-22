---
id: relevance-tuning
section: Ranking
title: Relevance Tuning with BM25, TF-IDF, and RRF
summary: Choose ranking strategies deliberately and combine lexical, field, feature, and scripted signals without losing control.
tags: [ranking, bm25, tfidf, rrf, relevance, tuning, rank-feature, script-score]
apis: [RankingAlgorithm, defaultBm25Config, reciprocalRankFusion, MatchQuery, DisMaxQuery, RankFeatureQuery, DistanceFeatureQuery, ScriptScoreQuery]
level: advanced
order: 30
---

# Relevance Tuning with BM25, TF-IDF, and RRF

Good search is not just about matching documents. It is about ordering them well.

Querylight TS gives you three useful tools for that:

- TF-IDF for classic term weighting
- BM25 for stronger length normalization and more modern lexical ranking
- reciprocal rank fusion for combining different ranked lists

On top of that, you can now tune within a ranked result set using:

- `DisMaxQuery` for best-field scoring
- `BoostingQuery` for soft demotion
- `RankFeatureQuery` for numeric feature influence
- `DistanceFeatureQuery` for recency or closeness boosts
- `ScriptScoreQuery` when you need custom JS scoring logic

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

## Prefer best-field scoring when clauses overlap

If the same idea is searched across several fields, additive bool scoring can over-reward documents that repeat the same terms everywhere.

Use `DisMaxQuery` when you want the strongest field to dominate:

```ts
import { DisMaxQuery, MatchQuery, OP } from "@tryformation/querylight-ts";

const query = new DisMaxQuery({
  queries: [
    new MatchQuery({ field: "title", text: "portable search", operation: OP.AND, boost: 3.0 }),
    new MatchQuery({ field: "tagline", text: "portable search", operation: OP.AND, boost: 2.0 }),
    new MatchQuery({ field: "body", text: "portable search", operation: OP.AND, boost: 1.0 })
  ],
  tieBreaker: 0.2
});
```

## Soft-demote instead of excluding

Use `BoostingQuery` when a document is still acceptable but should lose rank because of some secondary signal:

```ts
import { BoostingQuery, MatchQuery, TermQuery } from "@tryformation/querylight-ts";

const query = new BoostingQuery({
  positive: new MatchQuery({ field: "title", text: "querylight" }),
  negative: new TermQuery({ field: "tags", text: "deprecated" }),
  negativeBoost: 0.25
});
```

## Use numeric and date features directly

For business metrics and time-aware ranking, map fields with `NumericFieldIndex` or `DateFieldIndex`.

Then you can use:

- `RankFeatureQuery` for signals such as popularity, clicks, or quality
- `DistanceFeatureQuery` for recency or numeric closeness

```ts
import {
  DateFieldIndex,
  DistanceFeatureQuery,
  DocumentIndex,
  NumericFieldIndex,
  RankFeatureQuery
} from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  popularity: new NumericFieldIndex(),
  publishedAt: new DateFieldIndex()
});

const popularityBoost = new RankFeatureQuery({ field: "popularity" });
const recencyBoost = new DistanceFeatureQuery({
  field: "publishedAt",
  origin: new Date("2025-01-01T00:00:00.000Z"),
  pivot: 7 * 24 * 60 * 60 * 1000
});
```

## Use script scoring sparingly

`ScriptScoreQuery` lets you write a JavaScript function that receives the document, the current `_score`, and helpers such as `numericValue(field)`.

That is useful when:

- you need a one-off ranking formula
- you want to mix base lexical score with a business metric
- the scoring rule is too specific for a built-in query

```ts
import { ScriptScoreQuery, TermQuery } from "@tryformation/querylight-ts";

const query = new ScriptScoreQuery({
  query: new TermQuery({ field: "title", text: "querylight" }),
  script: ({ score, numericValue }) => score * (numericValue("popularity") ?? 1)
});
```

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
