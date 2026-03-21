---
id: schema-design
section: Schema
title: Choosing a Schema for Search
summary: Model titles, body text, filters, tags, and helper fields so search behavior stays predictable.
tags: [schema, fields, indexing, relevance, filters]
apis: [DocumentIndex, TextFieldIndex, Document]
level: foundation
order: 10
---

# Choosing a Schema for Search

Search quality starts with field design. Querylight TS does not hide that from you: you choose which fields exist, which analyzers they use, and which fields participate in ranking or filtering.

The main question is not "what does my source JSON look like?" but "what retrieval jobs do I need this index to do?"

## Start from user tasks

Typical tasks include:

- finding a page by title
- searching body text
- filtering by tags, category, or language
- powering autocomplete suggestions
- building facet sidebars
- producing related-content matches

Those tasks usually lead to different fields, even when they all come from the same source document.

## A practical field split

```ts
import { DocumentIndex, TextFieldIndex } from "@tryformation/querylight-ts";

const index = new DocumentIndex({
  title: new TextFieldIndex(),
  summary: new TextFieldIndex(),
  body: new TextFieldIndex(),
  tags: new TextFieldIndex(),
  section: new TextFieldIndex(),
  combined: new TextFieldIndex(),
  suggest: new TextFieldIndex()
});
```

This is a common pattern:

- `title`: high-signal short text
- `summary`: short descriptive text
- `body`: full content
- `tags`: exact-ish topical labels
- `section`: broad grouping such as `Overview` or `Queries`
- `combined`: duplicated text for broad multi-field recall
- `suggest`: a compact field tuned for autocomplete

## When to duplicate text on purpose

Duplication is often the right tradeoff.

For example, a `combined` field can join title, summary, tags, and body into one broad search surface:

```ts
index.index({
  id: "intro",
  fields: {
    title: ["Querylight TS"],
    summary: ["Portable browser and Node.js search"],
    body: ["A compact in-memory search toolkit."],
    tags: ["search", "browser", "typescript"],
    section: ["Overview"],
    combined: ["Querylight TS Portable browser and Node.js search A compact in-memory search toolkit. search browser typescript"],
    suggest: ["Querylight TS search browser typescript"]
  }
});
```

That makes broad retrieval simpler, while keeping dedicated fields available for focused queries and aggregations.

## Separate ranking fields from filter fields

A useful rule:

- fields like `title` and `body` usually affect ranking
- fields like `tags`, `section`, and `level` usually act as filters or facet sources

You can still search filter fields lexically, but treating them as metadata first often produces more stable behavior.

## Think in user-visible concepts

If users expect a filter called "section", add a `section` field. If they expect API names to be searchable, add an `api` field. Avoid hiding important navigation concepts inside one giant text blob.

Good schema design makes later features easier:

- highlighting needs the right content field
- aggregations need dedicated metadata fields
- autocomplete benefits from a compact suggestion field
- vector and lexical search both benefit from a clear document identity

## Common mistakes

- putting everything into one `body` field
- using analyzed free text where exact metadata would work better
- forgetting a helper field such as `combined`
- storing values in a format that is hard to sort or filter later

## A good default

For content-heavy apps, this is a solid first pass:

- one short title field
- one body field
- one summary or description field
- one or more metadata arrays such as `tags`
- one combined catch-all field
- one compact suggestion field

You can refine from there as real queries reveal where recall or precision needs work.
