import { describe, expect, it } from "vitest";
import {
  createSimpleTextSearchIndex,
  DateFieldIndex,
  DocumentIndex,
  GeoFieldIndex,
  NumericFieldIndex,
  SparseVectorFieldIndex,
  StoredSourceIndex,
  TextFieldIndex,
  VectorFieldIndex,
  createSeededRandom,
  parseJsonDslQuery,
  rectangleToPolygon,
  searchJsonDsl
} from "../src/index";

describe("json dsl", () => {
  it("executes bool queries with highlight and aggregations", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      body: new TextFieldIndex(),
      tags: new TextFieldIndex(),
      price: new NumericFieldIndex(),
      publishedAt: new DateFieldIndex()
    });

    index.index({
      id: "1",
      fields: {
        title: ["Vector search tutorial"],
        body: ["Portable search with vector ranking"],
        tags: ["vector", "tutorial"],
        price: ["10"],
        publishedAt: ["2025-01-02T00:00:00.000Z"]
      }
    });
    index.index({
      id: "2",
      fields: {
        title: ["Geo search guide"],
        body: ["Maps and polygons"],
        tags: ["geo"],
        price: ["20"],
        publishedAt: ["2025-01-15T00:00:00.000Z"]
      }
    });

    const response = await searchJsonDsl({
      index,
      request: {
        query: {
          bool: {
            must: [{ match: { title: { query: "vector tutorial", operator: "and" } } }],
            filter: [{ range: { price: { gte: "5", lte: "15" } } }]
          }
        },
        size: 5,
        highlight: {
          fields: {
            title: {}
          }
        },
        aggs: {
          tags: { terms: { field: "tags", size: 5 } },
          prices: { stats: { field: "price" } },
          published: { date_histogram: { field: "publishedAt", fixed_interval: "1d" } }
        }
      }
    });

    expect(response.hits.total.value).toBe(1);
    expect(response.hits.max_score).toBeGreaterThan(0);
    expect(response.hits.hits[0]?._index).toBe("querylight");
    expect(response.hits.hits[0]?._id).toBe("1");
    expect(response.hits.hits[0]?._source).toEqual({
      title: ["Vector search tutorial"],
      body: ["Portable search with vector ranking"],
      tags: ["vector", "tutorial"],
      price: ["10"],
      publishedAt: ["2025-01-02T00:00:00.000Z"]
    });
    expect(response.hits.hits[0]?.highlight?.title?.[0]).toContain("Vector search tutorial");
    expect(response.aggregations?.tags?.buckets).toEqual([
      { key: "vector", doc_count: 1 },
      { key: "tutorial", doc_count: 1 }
    ]);
    expect(response.aggregations?.prices).toMatchObject({ count: 1, min: 10, max: 10, avg: 10, sum: 10 });
    expect(response.aggregations?.published?.buckets).toEqual([
      { key: Date.parse("2025-01-02T00:00:00.000Z"), key_as_string: "2025-01-02T00:00:00.000Z", doc_count: 1 }
    ]);
  });

  it("supports geo, dense vector, sparse vector, and vector rescore clauses", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      loc: new GeoFieldIndex(),
      embedding: new VectorFieldIndex({ numHashTables: 2, dimensions: 3, random: createSeededRandom(42) }),
      sparseEmbedding: new SparseVectorFieldIndex()
    });

    index.index({ id: "berlin", fields: { title: ["Berlin vector cafe"], loc: [JSON.stringify({ type: "Point", coordinates: [13.4, 52.5] })] } });
    index.index({ id: "paris", fields: { title: ["Paris coffee guide"], loc: [JSON.stringify({ type: "Point", coordinates: [2.35, 48.85] })] } });

    const denseIndex = index.getFieldIndex("embedding") as VectorFieldIndex;
    denseIndex.insert("berlin", [[1, 0, 0]]);
    denseIndex.insert("paris", [[0, 1, 0]]);

    const sparseIndex = index.getFieldIndex("sparseEmbedding") as SparseVectorFieldIndex;
    sparseIndex.insert("berlin", [{ vector: 1, cafe: 0.5 }]);
    sparseIndex.insert("paris", [{ guide: 1, coffee: 0.7 }]);

    const geoResponse = await searchJsonDsl({
      index,
      request: {
        query: {
          geo_shape: {
            loc: {
              shape: {
                type: "Polygon",
                coordinates: rectangleToPolygon(12.0, 52.0, 14.0, 53.0)
              }
            }
          }
        }
      }
    });
    expect(geoResponse.hits.hits.map((hit) => hit._id)).toEqual(["berlin"]);

    const knnResponse = await searchJsonDsl({
      index,
      request: {
        query: {
          knn: {
            embedding: {
              vector: [1, 0, 0],
              k: 2
            }
          }
        }
      }
    });
    expect(knnResponse.hits.hits[0]?._id).toBe("berlin");

    const sparseResponse = await searchJsonDsl({
      index,
      request: {
        query: {
          neural_sparse: {
            sparseEmbedding: {
              vector: { vector: 1 },
              k: 2
            }
          }
        }
      }
    });
    expect(sparseResponse.hits.hits[0]?._id).toBe("berlin");

    const sparseRescoreResponse = await searchJsonDsl({
      index,
      request: {
        query: {
          sparse_vector_rescore: {
            field: "sparseEmbedding",
            vector: { vector: 1, cafe: 1 },
            query: {
              match: {
                title: {
                  query: "vector cafe",
                  operator: "or"
                }
              }
            },
            window_size: 2,
            rescore_query_weight: 2
          }
        }
      }
    });
    expect(sparseRescoreResponse.hits.hits[0]?._id).toBe("berlin");

    const rescoreResponse = await searchJsonDsl({
      index,
      request: {
        query: {
          vector_rescore: {
            field: "embedding",
            vector: [1, 0, 0],
            query: {
              match: {
                title: {
                  query: "vector cafe",
                  operator: "or"
                }
              }
            },
            window_size: 2,
            rescore_query_weight: 2
          }
        }
      }
    });
    expect(rescoreResponse.hits.hits[0]?._id).toBe("berlin");
  });

  it("supports reciprocal rank fusion through the json dsl", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      tags: new TextFieldIndex(),
      embedding: new VectorFieldIndex({ numHashTables: 2, dimensions: 3, random: createSeededRandom(42) })
    });

    index.index({ id: "1", fields: { title: ["vector search tutorial"], tags: ["vector"] } });
    index.index({ id: "2", fields: { title: ["geo search guide"], tags: ["geo"] } });
    index.index({ id: "3", fields: { title: ["vector cafe"], tags: ["coffee"] } });

    const denseIndex = index.getFieldIndex("embedding") as VectorFieldIndex;
    denseIndex.insert("1", [[1, 0, 0]]);
    denseIndex.insert("2", [[0, 1, 0]]);
    denseIndex.insert("3", [[0.8, 0.1, 0]]);

    const response = await searchJsonDsl({
      index,
      request: {
        query: {
          rrf: {
            rank_constant: 20,
            queries: [
              { match: { title: { query: "vector search", operator: "or" } } },
              { knn: { embedding: { vector: [1, 0, 0], k: 3 } } }
            ]
          }
        }
      }
    });

    expect(response.hits.hits[0]?._id).toBe("1");
    expect(response.hits.hits.map((hit) => hit._id)).toContain("3");
  });

  it("supports script and script_score clauses with params", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      popularity: new NumericFieldIndex()
    });

    index.index({ id: "1", fields: { title: ["querylight"], popularity: ["5"] } });
    index.index({ id: "2", fields: { title: ["querylight"], popularity: ["20"] } });

    const filtered = await searchJsonDsl({
      index,
      request: {
        query: {
          script: {
            script: {
              source: "(numericValue('popularity') ?? 0) >= params.minimum",
              params: { minimum: 10 }
            }
          }
        }
      }
    });
    expect(filtered.hits.hits.map((hit) => hit._id)).toEqual(["2"]);

    const rescored = await searchJsonDsl({
      index,
      request: {
        query: {
          script_score: {
            query: { term: { title: "querylight" } },
            script: {
              source: "score * (numericValue('popularity') ?? 1)"
            }
          }
        }
      }
    });
    expect(rescored.hits.hits.map((hit) => hit._id)).toEqual(["2", "1"]);
  });

  it("parses the remaining supported clause types", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      body: new TextFieldIndex(),
      tags: new TextFieldIndex(),
      price: new NumericFieldIndex(),
      publishedAt: new DateFieldIndex(),
      loc: new GeoFieldIndex()
    });

    index.index({
      id: "1",
      fields: {
        title: ["alpha beta"],
        body: ["portable search"],
        tags: ["featured", "alpha"],
        price: ["10"],
        publishedAt: ["2025-01-01T00:00:00.000Z"],
        loc: [JSON.stringify({ type: "Point", coordinates: [13.4, 52.5] })]
      }
    });
    index.index({
      id: "2",
      fields: {
        title: ["alpha gamma"],
        body: ["portable geo"],
        tags: ["deprecated"],
        price: ["20"],
        publishedAt: ["2025-01-10T00:00:00.000Z"],
        loc: [JSON.stringify({ type: "Point", coordinates: [2.35, 48.85] })]
      }
    });

    await expect(index.search(parseJsonDslQuery({ query: { prefix: { title: "alp" } } }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({ query: { wildcard: { title: "alp*" } } }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({ query: { regexp: { title: "^alp" } } }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({ query: { exists: { field: "tags" } } }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({ query: { match_phrase: { body: { query: "portable search" } } } }))).resolves.toHaveLength(1);
    await expect(index.search(parseJsonDslQuery({ query: { terms: { tags: ["featured", "deprecated"] } } }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({ query: { geo_point: { loc: { point: { lat: 52.5, lon: 13.4 }, boost: 2 } } } }))).resolves.toHaveLength(1);
    await expect(index.search(parseJsonDslQuery({
      query: {
        dis_max: {
          queries: [
            { term: { title: "alpha" } },
            { term: { body: "search" } }
          ],
          tie_breaker: 0.2
        }
      }
    }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({
      query: {
        boosting: {
          positive: { term: { title: "alpha" } },
          negative: { term: { tags: "deprecated" } },
          negative_boost: 0.1
        }
      }
    }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({
      query: {
        distance_feature: {
          field: "publishedAt",
          origin: "2025-01-05T00:00:00.000Z",
          pivot: 7 * 24 * 60 * 60 * 1000
        }
      }
    }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({
      query: {
        rank_feature: {
          field: "price",
          saturation: {
            pivot: 10
          }
        }
      }
    }))).resolves.toHaveLength(2);
    await expect(index.search(parseJsonDslQuery({
      query: {
        match_all: {}
      }
    }))).resolves.toHaveLength(2);
  });

  it("supports the beginner simple_text_search flow through json dsl", async () => {
    const search = createSimpleTextSearchIndex({
      documents: [
        {
          id: "range-filters",
          title: "RangeQuery Over Lexical Fields",
          description: "Use lexical ranges over sortable string values.",
          body: "RangeQuery compares lexical terms and supports range filters over string values.",
          tags: ["query", "range"]
        },
        {
          id: "serialization",
          title: "Index State Serialization",
          description: "Portable JSON index state for browser apps.",
          body: "Serialize and restore the in-memory index state.",
          tags: ["serialization"]
        }
      ],
      primaryFields: ["title"],
      secondaryFields: ["description", "body", "tags"]
    });

    const response = await searchJsonDsl({
      index: search,
      request: {
        simple_text_search: {
          query: "seralization"
        },
        aggs: {
          tags: { terms: { field: "tags", size: 5 } }
        }
      }
    });

    expect(response.hits.hits[0]?._id).toBe("serialization");
    expect(response.hits.hits[0]?._source).toMatchObject({
      id: "serialization",
      title: "Index State Serialization"
    });
    expect(response.aggregations?.tags?.buckets).toContainEqual({ key: "serialization", doc_count: 1 });
  });

  it("returns an OpenSearch-style envelope for empty hit pages", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex()
    });
    index.index({ id: "1", fields: { title: ["alpha"] } });

    const response = await searchJsonDsl({
      index,
      request: {
        query: {
          match_all: {}
        },
        from: 10,
        size: 5
      },
      indexName: "docs"
    });

    expect(response.hits.total).toEqual({ value: 1, relation: "eq" });
    expect(response.hits.max_score).toBeNull();
    expect(response.hits.hits).toEqual([]);
  });

  it("uses stored source payloads for _source when a StoredSourceIndex is configured", async () => {
    const index = new DocumentIndex({
      title: new TextFieldIndex(),
      _source: new StoredSourceIndex()
    });

    index.index({
      id: "1",
      fields: {
        title: ["alpha"]
      },
      source: {
        id: "1",
        title: "alpha",
        metadata: {
          section: "docs",
          views: 12
        }
      }
    });

    const response = await searchJsonDsl({
      index,
      request: {
        query: {
          term: {
            title: "alpha"
          }
        }
      }
    });

    expect(response.hits.hits[0]?._source).toEqual({
      id: "1",
      title: "alpha",
      metadata: {
        section: "docs",
        views: 12
      }
    });
  });
});
