---
id: geo-search
section: Advanced
title: Geo Indexing with Points and Polygons
summary: Store GeoJSON and query by point containment or polygon intersection.
tags: [geo, geohash, polygon, point, geometry]
apis: [GeoFieldIndex, GeoPointQuery, GeoPolygonQuery, rectangleToPolygon]
level: advanced
order: "11"
city: Warsaw
lat: 52.2297
lon: 21.0122
---

# Geo Indexing with Points and Polygons

`GeoFieldIndex` stores GeoJSON and indexes it by geohash.

## Point query

```ts
import { GeoPointQuery } from "@tryformation/querylight-ts";

const query = new GeoPointQuery("location", 52.52, 13.405);
```

## Polygon query

```ts
import { GeoPolygonQuery, rectangleToPolygon } from "@tryformation/querylight-ts";

const query = new GeoPolygonQuery(
  "location",
  rectangleToPolygon(-10, 48, 25, 61)
);
```

The demo maps documentation topics to example points so the geo API can be explored from the same browser.

## Learn more

- [GeoJSON on Wikipedia](https://en.wikipedia.org/wiki/GeoJSON)
- [RFC 7946: The GeoJSON Format](https://www.rfc-editor.org/rfc/rfc7946)
- [Geohash on Wikipedia](https://en.wikipedia.org/wiki/Geohash)
