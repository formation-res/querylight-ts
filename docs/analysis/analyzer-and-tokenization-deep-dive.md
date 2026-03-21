---
id: analyzer-deep-dive
section: Analysis
title: Analyzer and Tokenization Deep Dive
summary: Understand how tokenization and token filters change matching behavior, recall, and precision.
tags: [analysis, analyzer, tokenizer, normalization, ngrams]
apis: [Analyzer, KeywordTokenizer, NgramTokenFilter, EdgeNgramsTokenFilter, TextFieldIndex]
level: indexing
order: 20
---

# Analyzer and Tokenization Deep Dive

Search indexes do not store raw text as-is. They store analyzed terms. Querylight TS makes that analysis explicit so you can control how text is transformed during indexing and querying.

## What an analyzer does

An analyzer turns input text into terms.

Conceptually:

1. tokenize the text
2. normalize or filter the tokens
3. index the resulting terms

That choice affects:

- whether `Querylight` matches `querylight`
- whether prefixes are easy to find
- whether typos can be recovered
- how large the index becomes

## Keyword vs tokenized text

`KeywordTokenizer` treats the whole input as one token. That is useful for fields such as:

- tags
- section names
- ids
- exact categories

Free text fields usually need a normal analyzer so a sentence becomes multiple searchable terms.

## Ngrams and edge ngrams

`NgramTokenFilter` helps with fuzzy recovery because it breaks text into overlapping slices.

```ts
import { Analyzer, NgramTokenFilter, TextFieldIndex } from "@tryformation/querylight-ts";

const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const field = new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer);
```

This improves recall for misspellings, but it also:

- increases index size
- can introduce noisier matches

`EdgeNgramsTokenFilter` is different. It keeps prefixes from the start of a token and is therefore useful for autocomplete:

```ts
import { Analyzer, EdgeNgramsTokenFilter, TextFieldIndex } from "@tryformation/querylight-ts";

const suggestAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const suggestField = new TextFieldIndex(suggestAnalyzer, suggestAnalyzer);
```

## Analysis is a relevance decision

Analyzer choice is not just a technical detail. It changes what counts as "similar enough" to match.

Examples:

- keyword-style analysis favors precision
- broader tokenization favors recall
- ngrams can recover typos
- edge ngrams can make prefix suggestions feel fast

## Field-by-field analysis works best

Different fields usually need different treatment.

- `title`: normal text analysis
- `body`: normal text analysis
- `tags`: keyword-like analysis
- `suggest`: edge ngrams
- typo-recovery field: ngrams

That is usually better than applying one global strategy to everything.

## A practical mental model

Ask three questions for every field:

1. Should this field behave like free text or exact metadata?
2. Do I need typo recovery here?
3. Do I need prefix suggestions here?

The answers usually tell you which analyzer shape you need.

## Tradeoffs to watch

- More aggressive analysis improves recall but may lower precision.
- Ngram-heavy fields cost more memory.
- Very broad analysis can make short queries noisy.

Start with simple field-specific analyzers, then expand only when actual queries show gaps.
