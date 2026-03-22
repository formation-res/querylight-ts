---
id: article-length-facets-demo
section: Demo Internals
title: Article Length Facets in the Demo
summary: How the demo calculates article word count, builds numeric buckets, and turns them into live sidebar filters.
tags: [demo, aggregation, numeric, histogram, range, facets]
apis: [NumericFieldIndex, rangeAggregation, histogram, stats, RangeQuery]
level: advanced
order: 21
---

# Article Length Facets in the Demo

The demo now exposes article length as a numeric facet in the right sidebar.

That adds a different kind of navigation signal than tags or sections:

- short articles for quick orientation
- medium articles for practical walkthroughs
- longer articles for deeper reference material

## How the value is created

The build step strips markdown to plain text and counts words per document.

That value is stored as `wordCount` in the generated demo payload and indexed with `NumericFieldIndex`.

Conceptually, the build pipeline does this:

```ts
const body = stripMarkdown(markdownBody);
const wordCount = body.split(/\s+/).filter(Boolean).length;
```

Then the numeric field is indexed like any other structured field:

```ts
fields: {
  wordCount: [String(entry.wordCount)]
}
```

## How the sidebar derives buckets

At runtime, the sidebar computes numeric aggregations over the currently selected result ids.

The demo uses:

- `stats()` for the summary line
- `rangeAggregation(...)` for human-readable buckets
- `histogram(...)` for the compact visual distribution

The range buckets are explicit:

```ts
[
  { key: "short", to: 400 },
  { key: "medium", from: 400, to: 800 },
  { key: "long", from: 800, to: 1400 },
  { key: "deep", from: 1400 }
]
```

This keeps the labels stable even as the result set changes.

## How filtering works

When a user clicks an article-length chip, the demo does not run a special side query.

It updates the normal search state and adds a `RangeQuery("wordCount", ...)` filter.

That means:

1. the main search reruns
2. the result set changes
3. the numeric buckets are recomputed from the new subset

So the sidebar stays consistent with the visible results.

## Why this is useful

Length is not a topical facet, but it is often a useful navigation hint in docs:

- beginners may prefer shorter pages first
- users troubleshooting something specific may prefer dense reference pages
- it demonstrates that Querylight facets are not limited to keyword metadata

## Related articles

- [How the Aggregations Sidebar Works](./tag-aggregations-sidebar.md)
- [Range Aggregation](../discovery/range-aggregation.md)
- [Histogram Aggregation](../discovery/histogram-aggregation.md)
- [NumericFieldIndex and DateFieldIndex for Structured Features](../indexing/numeric-and-date-fields.md)
