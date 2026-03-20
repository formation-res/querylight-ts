---
id: reciprocal-rank-fusion
section: Advanced
title: Reciprocal Rank Fusion
summary: Combine multiple ranked result lists from lexical, filtered, geo, or vector search.
tags: [ranking, rrf, fusion, vector, geo, filters]
apis: [reciprocalRankFusion, MatchQuery, GeoPointQuery, VectorFieldIndex, bigramVector]
level: advanced
order: "14"
city: Berlin
lat: 52.52
lon: 13.405
---

# Reciprocal Rank Fusion

`reciprocalRankFusion` combines ranked hit lists without requiring the scores to be on the same scale.

That matters when you want to merge:

- BM25 or TF-IDF text results
- Filtered or geo-constrained searches
- Approximate vector search results

## Combine lexical and vector search

```ts
import {
  DocumentIndex,
  MatchQuery,
  TextFieldIndex,
  VectorFieldIndex,
  bigramVector,
  createSeededRandom,
  reciprocalRankFusion
} from "@querylight/core";

const textIndex = new DocumentIndex({ title: new TextFieldIndex() });
const vectorIndex = new VectorFieldIndex(8, 36 * 36, createSeededRandom(42));

textIndex.index({ id: "1", fields: { title: ["specialty coffee brewing"] } });
textIndex.index({ id: "2", fields: { title: ["coffee shops in berlin"] } });

vectorIndex.insert("1", [bigramVector("specialty coffee brewing")]);
vectorIndex.insert("2", [bigramVector("coffee shops in berlin")]);

const lexicalHits = textIndex.search(new MatchQuery("title", "coffee brewing"));
const vectorHits = vectorIndex.query(bigramVector("cofee bruwing"), 10);

const fusedHits = reciprocalRankFusion([lexicalHits, vectorHits]);
```

## Combine structured search with a geo constraint

```ts
import {
  GeoPointQuery,
  MatchQuery,
  reciprocalRankFusion
} from "@querylight/core";

const lexicalHits = index.search(new MatchQuery("title", "specialty coffee"));
const geoHits = index.search(new GeoPointQuery("location", 52.52, 13.405));

const fusedHits = reciprocalRankFusion([lexicalHits, geoHits], {
  rankConstant: 20
});
```

## Notes

- RRF uses rank positions, not raw scores, so lexical and vector scales do not need calibration first.
- Documents present in multiple result lists usually move up.
- `rankConstant` defaults to `60`; smaller values reward top-ranked overlaps more aggressively.
- Use `weights` if one ranking should matter more than another.

## Learn more

- [Reciprocal rank fusion paper in the IR Anthology](https://ir.webis.de/anthology/2009.sigirconf_conference-2009.146/)
- [Data fusion in information retrieval on Wikipedia](https://en.wikipedia.org/wiki/Data_fusion#Information_retrieval)
- [Introducing approximate nearest neighbor search in Elasticsearch 8.0](https://www.elastic.co/blog/introducing-approximate-nearest-neighbor-search-in-elasticsearch-8-0)
