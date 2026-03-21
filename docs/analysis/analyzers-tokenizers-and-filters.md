---
id: analysis-pipeline
section: Analysis
title: Analyzers, Tokenizers, and Filters
summary: Normalization is explicit, so you can tailor indexing and querying behavior per field.
tags: [analysis, analyzer, tokenizer, ngrams, normalization]
apis: [Analyzer, KeywordTokenizer, NgramTokenFilter, EdgeNgramsTokenFilter]
level: foundation
order: 10
---

# Analyzers, Tokenizers, and Filters

The analysis pipeline lets you choose how text is normalized before it is indexed or queried.

## Default behavior

The default `Analyzer` applies:

- `LowerCaseTextFilter`
- `ElisionTextFilter`
- `InterpunctionTextFilter`
- `SplittingTokenizer`

## Exact keyword fields

Use `KeywordTokenizer` when a field should stay as a single token, for example tags, categories, and IDs.

```ts
import { Analyzer, KeywordTokenizer, TextFieldIndex } from "@tryformation/querylight-ts";

const keywordAnalyzer = new Analyzer([], new KeywordTokenizer());
const tags = new TextFieldIndex(keywordAnalyzer, keywordAnalyzer);
```

## Fuzzy and autocomplete-oriented analyzers

Use `NgramTokenFilter` for typo-tolerant matching and `EdgeNgramsTokenFilter` for suggestion-style prefix indexing.

```ts
import { Analyzer, EdgeNgramsTokenFilter, NgramTokenFilter } from "@tryformation/querylight-ts";

const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const suggestAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
```

## Learn more

- [N-gram on Wikipedia](https://en.wikipedia.org/wiki/N-gram)
