import { Analyzer } from "./analysis";
import { type RandomSource } from "./random";
import { type FieldIndex, type Hit, type Hits, type IndexState, type IndexStateBase } from "./shared";

/** Dense numeric vector used for ANN indexing and reranking. */
export type Vector = number[];

/** Serialized state for {@link VectorFieldIndex}. */
export interface VectorFieldIndexState extends IndexStateBase {
  kind: "VectorFieldIndexState";
  numHashTables: number;
  dimensions: number;
  vectors: Record<string, Vector[]>;
  randomVectorsList: Vector[][];
}

/** Locality-sensitive hash based vector index for approximate nearest-neighbor retrieval. */
export class VectorFieldIndex implements FieldIndex {
  private readonly vectors = new Map<string, Vector[]>();
  private readonly allBuckets: Array<Map<number, Array<[string, Vector]>>> = [];
  private readonly randomVectorsList: Vector[][] = [];
  private readonly random: RandomSource;

  constructor(
    private readonly numHashTables: number,
    private readonly dimensions: number,
    random: RandomSource = Math.random,
    initialRandomVectors?: Vector[][]
  ) {
    this.random = random;
    if (initialRandomVectors) {
      this.randomVectorsList.push(...initialRandomVectors.map((vectors) => vectors.map((vector) => [...vector])));
      for (let i = 0; i < this.numHashTables; i += 1) {
        this.allBuckets.push(new Map());
      }
    } else {
      for (let i = 0; i < this.numHashTables; i += 1) {
        const randomVectors = Array.from({ length: this.dimensions }, () => normalizeVector(generateRandomVector(this.dimensions, this.random)));
        this.randomVectorsList.push(randomVectors);
        this.allBuckets.push(new Map());
      }
    }
  }

  get indexState(): VectorFieldIndexState {
    return {
      kind: "VectorFieldIndexState",
      numHashTables: this.numHashTables,
      dimensions: this.dimensions,
      vectors: Object.fromEntries([...this.vectors.entries()].map(([id, value]) => [id, value.map((vector) => [...vector])])),
      randomVectorsList: this.randomVectorsList.map((vectors) => vectors.map((vector) => [...vector]))
    };
  }

  loadState(fieldIndexState: IndexState): FieldIndex {
    if (fieldIndexState.kind !== "VectorFieldIndexState") {
      throw new Error(`wrong index type; expecting VectorFieldIndexState but was ${fieldIndexState.kind}`);
    }
    const loaded = new VectorFieldIndex(
      fieldIndexState.numHashTables,
      fieldIndexState.dimensions,
      this.random,
      fieldIndexState.randomVectorsList
    );
    for (const [id, vectors] of Object.entries(fieldIndexState.vectors)) {
      loaded.insert(id, vectors);
    }
    return loaded;
  }

  insert(id: string, embeddings: Vector[]): void {
    this.vectors.set(id, embeddings);
    for (const vector of embeddings) {
      for (let i = 0; i < this.numHashTables; i += 1) {
        const hash = hashFunction(vector, this.randomVectorsList[i]!);
        const buckets = this.allBuckets[i]!;
        const values = buckets.get(hash) ?? [];
        values.push([id, vector]);
        buckets.set(hash, values);
      }
    }
  }

  query(vector: Vector, k: number, filterIds?: string[]): Hits {
    const candidates = new Map<string, Vector[]>();
    const allowed = filterIds ? new Set(filterIds) : null;
    for (let i = 0; i < this.numHashTables; i += 1) {
      const hash = hashFunction(vector, this.randomVectorsList[i]!);
      const bucket = this.allBuckets[i]!.get(hash) ?? [];
      for (const [id, candidate] of bucket) {
        if (!allowed || allowed.has(id)) {
          const values = candidates.get(id) ?? [];
          values.push(candidate);
          candidates.set(id, values);
        }
      }
    }
    return [...candidates.entries()]
      .map(([id, candidatesForId]) => [id, Math.max(...candidatesForId.map((candidate) => cosineSimilarity(vector, candidate)))] as Hit)
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }

  rerank(vector: Vector, candidateIds: string[], k = candidateIds.length): Hits {
    return candidateIds
      .map((id) => {
        const candidates = this.vectors.get(id) ?? [];
        if (candidates.length === 0) {
          return null;
        }
        return [id, Math.max(...candidates.map((candidate) => cosineSimilarity(vector, candidate)))] as Hit;
      })
      .filter((hit): hit is Hit => hit !== null)
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }
}

/** Computes cosine similarity for two equal-length vectors. */
export function cosineSimilarity(v1: Vector, v2: Vector): number {
  if (v1.length !== v2.length) {
    throw new Error("Vectors must be of the same size");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < v1.length; i += 1) {
    dotProduct += v1[i]! * v2[i]!;
    normA += v1[i]! * v1[i]!;
    normB += v2[i]! * v2[i]!;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Creates a random vector of the requested dimensionality. */
export function generateRandomVector(dimensions: number, random: RandomSource = Math.random): Vector {
  return Array.from({ length: dimensions }, () => random());
}

/** Returns a unit-length copy of the provided vector. */
export function normalizeVector(vector: Vector): Vector {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
}

/** Hashes a vector against a list of random projection vectors. */
export function hashFunction(vector: Vector, randomVectors: Vector[]): number {
  let hash = 0;
  for (let i = 0; i < randomVectors.length; i += 1) {
    const dotProduct = vector.reduce((sum, value, index) => sum + value * (randomVectors[i]![index] ?? 0), 0);
    if (dotProduct > 0) {
      hash |= 1 << i;
    }
  }
  return hash;
}

/** Populates LSH buckets for a single vector per id. */
export function populateLSHBuckets(vectors: Record<string, Vector>, randomVectors: Vector[]): Map<number, Array<[string, Vector]>> {
  const buckets = new Map<number, Array<[string, Vector]>>();
  for (const [id, vector] of Object.entries(vectors)) {
    const hash = hashFunction(vector, randomVectors);
    const values = buckets.get(hash) ?? [];
    values.push([id, vector]);
    buckets.set(hash, values);
  }
  return buckets;
}

/** Creates a fixed-size bigram-count vector from analyzed text or tokens. */
export function bigramVector(tokens: string[]): Vector;
export function bigramVector(text: string, analyzer?: Analyzer): Vector;
export function bigramVector(input: string[] | string, analyzer: Analyzer = new Analyzer()): Vector {
  const tokens = typeof input === "string" ? analyzer.analyze(input) : input;
  const dimensions = 36 * 36;
  const vector = Array.from({ length: dimensions }, () => 0);
  const idx = (char: string): number | null => {
    if (char >= "0" && char <= "9") return char.charCodeAt(0) - "0".charCodeAt(0);
    const lower = char.toLowerCase();
    if (lower >= "a" && lower <= "z") return lower.charCodeAt(0) - "a".charCodeAt(0) + 10;
    return null;
  };
  for (const token of tokens) {
    const chars = [...token].filter((char) => /[a-z0-9]/i.test(char)).join("").toLowerCase();
    if (chars.length > 1) {
      const codes = [...chars].map(idx).filter((value): value is number => value != null);
      for (let i = 0; i < codes.length - 1; i += 1) {
        const index = codes[i]! * 36 + codes[i + 1]!;
        vector[index] = (vector[index] ?? 0) + 1;
      }
    }
  }
  return vector;
}
