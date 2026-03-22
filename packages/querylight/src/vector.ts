import { Analyzer } from "./analysis";
import { type RandomSource } from "./random";
import { type FieldIndex, type Hit, type Hits, type IndexState, type IndexStateBase } from "./shared";

/** Dense numeric vector used for ANN indexing and reranking. */
export type Vector = number[];

/** Prepared vector storage used by vector scorers. */
export type PreparedVector = Float32Array;

/** Scores a query vector against one or more prepared candidate vectors. */
export interface VectorScorer {
  /** Normalizes and converts an input vector into the scorer's preferred in-memory form. */
  prepare(vector: ArrayLike<number>, dimensions: number): PreparedVector;
  /** Returns the highest score across a candidate set for one document. */
  bestScore(query: PreparedVector, candidates: ReadonlyArray<PreparedVector>): number;
}

/** Optional async scoring extension for backends such as WebGPU. */
export interface AsyncVectorScorer {
  /** Ranks candidate groups and returns the top hits for the given query. */
  rankCandidatesAsync(query: PreparedVector, candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>, k: number): Promise<Hits>;
}

/** Default CPU scorer that uses normalized float32 vectors and dot-product scoring. */
export class CpuVectorScorer implements VectorScorer {
  prepare(vector: ArrayLike<number>, dimensions: number): PreparedVector {
    return normalizeTypedVector(vector, dimensions);
  }

  bestScore(query: PreparedVector, candidates: ReadonlyArray<PreparedVector>): number {
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const score = dotProduct(query, candidate);
      if (score > bestScore) {
        bestScore = score;
      }
    }
    return bestScore;
  }
}

/** Tuning options for locality-sensitive hashing in {@link VectorFieldIndex}. */
export interface VectorFieldIndexOptions {
  /** Number of random projections used to build each hash table bucket key. */
  hashBitsPerTable?: number;
  /** Dense scoring backend used for preparing and scoring candidate vectors. */
  scorer?: VectorScorer;
}

/** Value-object constructor params for {@link VectorFieldIndex}. */
export interface VectorFieldIndexParams {
  /** Number of independent hash tables used during approximate retrieval. */
  numHashTables: number;
  /** Dimensionality of stored vectors. */
  dimensions: number;
  /** Random source used to create projection vectors. */
  random?: RandomSource;
  /** Optional precomputed random projection vectors for deterministic hydration. */
  initialRandomVectors?: Vector[][];
  /** Optional LSH tuning settings. */
  options?: VectorFieldIndexOptions;
}

/** Serialized state for {@link VectorFieldIndex}. */
export interface VectorFieldIndexState extends IndexStateBase {
  kind: "VectorFieldIndexState";
  numHashTables: number;
  dimensions: number;
  hashBitsPerTable: number;
  vectors: Record<string, Vector[]>;
  randomVectorsList: Vector[][];
}

/** Locality-sensitive hash based vector index for approximate nearest-neighbor retrieval. */
export class VectorFieldIndex implements FieldIndex {
  private readonly vectors = new Map<string, PreparedVector[]>();
  private readonly allBuckets: Array<Map<number, Array<[string, PreparedVector]>>> = [];
  private readonly randomVectorsList: PreparedVector[][] = [];
  private readonly random: RandomSource;
  private readonly scorer: VectorScorer;
  private readonly numHashTables: number;
  private readonly dimensions: number;
  private readonly hashBitsPerTable: number;

  constructor(params: VectorFieldIndexParams);
  constructor(
    numHashTables: number,
    dimensions: number,
    random?: RandomSource,
    initialRandomVectors?: Vector[][],
    options?: VectorFieldIndexOptions
  );
  constructor(
    numHashTablesOrParams: number | VectorFieldIndexParams,
    dimensions?: number,
    random: RandomSource = Math.random,
    initialRandomVectors?: Vector[][],
    options: VectorFieldIndexOptions = {}
  ) {
    const params = typeof numHashTablesOrParams === "number"
      ? {
          numHashTables: numHashTablesOrParams,
          dimensions: dimensions ?? 0,
          random,
          initialRandomVectors,
          options
        }
      : numHashTablesOrParams;

    this.numHashTables = params.numHashTables;
    this.dimensions = params.dimensions;
    this.random = params.random ?? Math.random;
    this.scorer = params.options?.scorer ?? new CpuVectorScorer();
    this.hashBitsPerTable = assertValidHashBits(
      params.options?.hashBitsPerTable ?? params.initialRandomVectors?.[0]?.length ?? defaultHashBitsPerTable(this.dimensions)
    );

    if (!Number.isInteger(this.numHashTables) || this.numHashTables <= 0) {
      throw new Error("numHashTables must be a positive integer");
    }
    if (!Number.isInteger(this.dimensions) || this.dimensions <= 0) {
      throw new Error("dimensions must be a positive integer");
    }

    const providedRandomVectors = params.initialRandomVectors;
    if (providedRandomVectors) {
      if (providedRandomVectors.length !== this.numHashTables) {
        throw new Error("initialRandomVectors length must match numHashTables");
      }
      if (providedRandomVectors.some((vectors) => vectors.length !== this.hashBitsPerTable)) {
        throw new Error("initialRandomVectors must contain hashBitsPerTable projections for every hash table");
      }
    }

    if (providedRandomVectors) {
      this.randomVectorsList.push(...providedRandomVectors.map((vectors) => vectors.map((vector) => toFloat32Vector(vector, this.dimensions))));
      for (let i = 0; i < this.numHashTables; i += 1) {
        this.allBuckets.push(new Map());
      }
      return;
    }

    for (let i = 0; i < this.numHashTables; i += 1) {
      const randomVectors = Array.from(
        { length: this.hashBitsPerTable },
        () => toFloat32Vector(normalizeVector(generateRandomVector(this.dimensions, this.random)), this.dimensions)
      );
      this.randomVectorsList.push(randomVectors);
      this.allBuckets.push(new Map());
    }
  }

  get indexState(): VectorFieldIndexState {
    return {
      kind: "VectorFieldIndexState",
      numHashTables: this.numHashTables,
      dimensions: this.dimensions,
      hashBitsPerTable: this.hashBitsPerTable,
      vectors: Object.fromEntries([...this.vectors.entries()].map(([id, value]) => [id, value.map((vector) => Array.from(vector))])),
      randomVectorsList: this.randomVectorsList.map((vectors) => vectors.map((vector) => Array.from(vector)))
    };
  }

  loadState(fieldIndexState: IndexState): FieldIndex {
    if (fieldIndexState.kind !== "VectorFieldIndexState") {
      throw new Error(`wrong index type; expecting VectorFieldIndexState but was ${fieldIndexState.kind}`);
    }
    const loaded = new VectorFieldIndex({
      numHashTables: fieldIndexState.numHashTables,
      dimensions: fieldIndexState.dimensions,
      random: this.random,
      initialRandomVectors: fieldIndexState.randomVectorsList,
      options: { hashBitsPerTable: fieldIndexState.hashBitsPerTable ?? fieldIndexState.randomVectorsList[0]?.length }
    });
    for (const [id, vectors] of Object.entries(fieldIndexState.vectors)) {
      loaded.insert(id, vectors);
    }
    return loaded;
  }

  insert(id: string, embeddings: Vector[]): void {
    const preparedEmbeddings = embeddings.map((vector) => this.scorer.prepare(vector, this.dimensions));
    this.vectors.set(id, preparedEmbeddings);
    for (const vector of preparedEmbeddings) {
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
    const preparedQuery = this.scorer.prepare(vector, this.dimensions);
    return scorePreparedCandidatesSync(this.scorer, preparedQuery, collectCandidateGroups(this.allBuckets, this.randomVectorsList, this.numHashTables, preparedQuery, filterIds), k);
  }

  async queryAsync(vector: Vector, k: number, filterIds?: string[]): Promise<Hits> {
    const preparedQuery = this.scorer.prepare(vector, this.dimensions);
    return scorePreparedCandidatesAsync(this.scorer, preparedQuery, collectCandidateGroups(this.allBuckets, this.randomVectorsList, this.numHashTables, preparedQuery, filterIds), k);
  }

  rerank(vector: Vector, candidateIds: string[], k = candidateIds.length): Hits {
    const preparedQuery = this.scorer.prepare(vector, this.dimensions);
    return scorePreparedCandidatesSync(this.scorer, preparedQuery, collectStoredCandidateGroups(this.vectors, candidateIds), k);
  }

  async rerankAsync(vector: Vector, candidateIds: string[], k = candidateIds.length): Promise<Hits> {
    const preparedQuery = this.scorer.prepare(vector, this.dimensions);
    return scorePreparedCandidatesAsync(this.scorer, preparedQuery, collectStoredCandidateGroups(this.vectors, candidateIds), k);
  }
}

/** Computes cosine similarity for two equal-length vectors. */
export function cosineSimilarity(v1: Vector, v2: Vector): number {
  assertSameDimensions(v1, v2.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < v1.length; i += 1) {
    dot += (v1[i] ?? 0) * (v2[i] ?? 0);
    normA += (v1[i] ?? 0) * (v1[i] ?? 0);
    normB += (v2[i] ?? 0) * (v2[i] ?? 0);
  }
  if (normA === 0 || normB === 0) {
    throw new Error("Vector norm must be greater than 0");
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Creates a random vector of the requested dimensionality. */
export function generateRandomVector(dimensions: number, random: RandomSource = Math.random): Vector {
  return Array.from({ length: dimensions }, () => random());
}

/** Returns a unit-length copy of the provided vector. */
export function normalizeVector(vector: Vector): Vector {
  return Array.from(normalizeTypedVector(vector, vector.length));
}

/** Hashes a vector against a list of random projection vectors. */
export function hashFunction(vector: ArrayLike<number>, randomVectors: Array<ArrayLike<number>>): number {
  assertSameDimensions(vector, randomVectors[0]?.length ?? vector.length);
  assertValidHashBits(randomVectors.length);
  let hash = 0;
  for (let i = 0; i < randomVectors.length; i += 1) {
    if (dotProduct(vector, randomVectors[i]!) > 0) {
      hash += 2 ** i;
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

function normalizeTypedVector(vector: ArrayLike<number>, dimensions: number): Float32Array {
  const typed = toFloat32Vector(vector, dimensions);
  let norm = 0;
  for (let i = 0; i < typed.length; i += 1) {
    norm += typed[i]! * typed[i]!;
  }
  if (norm === 0) {
    throw new Error("Vector norm must be greater than 0");
  }
  const scale = 1 / Math.sqrt(norm);
  for (let i = 0; i < typed.length; i += 1) {
    typed[i] = typed[i]! * scale;
  }
  return typed;
}

function toFloat32Vector(vector: ArrayLike<number>, dimensions: number): Float32Array {
  assertSameDimensions(vector, dimensions);
  const typed = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i += 1) {
    typed[i] = vector[i] ?? 0;
  }
  return typed;
}

function assertSameDimensions(vector: ArrayLike<number>, dimensions: number): void {
  if (vector.length !== dimensions) {
    throw new Error("Vectors must be of the same size");
  }
}

function dotProduct(left: ArrayLike<number>, right: ArrayLike<number>): number {
  assertSameDimensions(left, right.length);
  let sum = 0;
  for (let i = 0; i < left.length; i += 1) {
    sum += (left[i] ?? 0) * (right[i] ?? 0);
  }
  return sum;
}

function defaultHashBitsPerTable(dimensions: number): number {
  return Math.min(dimensions, 16);
}

function assertValidHashBits(hashBitsPerTable: number): number {
  if (!Number.isInteger(hashBitsPerTable) || hashBitsPerTable <= 0 || hashBitsPerTable > 52) {
    throw new Error("hashBitsPerTable must be a positive integer between 1 and 52");
  }
  return hashBitsPerTable;
}

function selectTopHits(source: Map<string, number> | Hits, k: number): Hits {
  const hits = source instanceof Map ? [...source.entries()].map(([id, score]) => [id, score] as Hit) : [...source];
  if (k <= 0) {
    return [];
  }
  if (k >= hits.length) {
    return hits.sort((left, right) => right[1] - left[1]);
  }

  const top: Hits = [];
  for (const hit of hits) {
    if (top.length === 0) {
      top.push(hit);
      continue;
    }

    let inserted = false;
    for (let i = 0; i < top.length; i += 1) {
      if (hit[1] > top[i]![1]) {
        top.splice(i, 0, hit);
        inserted = true;
        break;
      }
    }
    if (!inserted && top.length < k) {
      top.push(hit);
    }
    if (inserted && top.length > k) {
      top.pop();
    }
  }

  return top;
}

function collectCandidateGroups(
  allBuckets: Array<Map<number, Array<[string, PreparedVector]>>>,
  randomVectorsList: PreparedVector[][],
  numHashTables: number,
  preparedQuery: PreparedVector,
  filterIds?: string[]
): Map<string, PreparedVector[]> {
  const candidatesById = new Map<string, PreparedVector[]>();
  const allowed = filterIds ? new Set(filterIds) : null;

  for (let i = 0; i < numHashTables; i += 1) {
    const hash = hashFunction(preparedQuery, randomVectorsList[i]!);
    const bucket = allBuckets[i]!.get(hash) ?? [];
    for (const [id, candidate] of bucket) {
      if (!allowed || allowed.has(id)) {
        const candidates = candidatesById.get(id) ?? [];
        candidates.push(candidate);
        candidatesById.set(id, candidates);
      }
    }
  }

  return candidatesById;
}

function collectStoredCandidateGroups(
  vectors: Map<string, PreparedVector[]>,
  candidateIds: string[]
): Map<string, PreparedVector[]> {
  const candidatesById = new Map<string, PreparedVector[]>();

  for (const id of candidateIds) {
    const candidates = vectors.get(id);
    if (candidates && candidates.length > 0) {
      candidatesById.set(id, candidates);
    }
  }

  return candidatesById;
}

function scorePreparedCandidatesSync(
  scorer: VectorScorer,
  preparedQuery: PreparedVector,
  candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>,
  k: number
): Hits {
  const scores = new Map<string, number>();
  for (const [id, candidates] of candidatesById.entries()) {
    scores.set(id, scorer.bestScore(preparedQuery, candidates));
  }
  return selectTopHits(scores, k);
}

async function scorePreparedCandidatesAsync(
  scorer: VectorScorer,
  preparedQuery: PreparedVector,
  candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>,
  k: number
): Promise<Hits> {
  if (hasAsyncVectorScorer(scorer)) {
    return scorer.rankCandidatesAsync(preparedQuery, candidatesById, k);
  }
  return scorePreparedCandidatesSync(scorer, preparedQuery, candidatesById, k);
}

function hasAsyncVectorScorer(scorer: VectorScorer): scorer is VectorScorer & AsyncVectorScorer {
  return "rankCandidatesAsync" in scorer && typeof scorer.rankCandidatesAsync === "function";
}
