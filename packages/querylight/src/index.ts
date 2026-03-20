import {
  Analyzer,
  type TextFilter,
  type TokenFilter,
  type Tokenizer,
  EdgeNgramsTokenFilter,
  ElisionTextFilter,
  InterpunctionTextFilter,
  KeywordTokenizer,
  LowerCaseTextFilter,
  NgramTokenFilter,
  SplittingTokenizer
} from "./analysis";
import {
  decodeGeohashBounds,
  encodeGeohash,
  type Geometry,
  geohashesForGeometry,
  type MultiPolygonCoordinates,
  type PolygonCoordinates,
  geometryContainsPoint,
  geometryIntersectsGeohash,
  geometryIntersectsPolygon,
  rectangleToPolygon
} from "./geo";
import { createSeededRandom, type RandomSource } from "./random";
import { SimpleStringTrie, TrieNode, type TrieNodeState } from "./trie";

export {
  Analyzer,
  EdgeNgramsTokenFilter,
  ElisionTextFilter,
  InterpunctionTextFilter,
  KeywordTokenizer,
  LowerCaseTextFilter,
  NgramTokenFilter,
  SplittingTokenizer,
  SimpleStringTrie,
  TrieNode,
  createSeededRandom,
  rectangleToPolygon
};

export type { Geometry, MultiPolygonCoordinates, PolygonCoordinates, TextFilter, TokenFilter, Tokenizer, TrieNodeState, RandomSource };

export interface Document {
  id: string;
  fields: Record<string, string[]>;
}

export type Hit = [string, number];
export type Hits = Hit[];

export interface Query {
  readonly boost: number | undefined;
  hits(documentIndex: DocumentIndex, context?: QueryContext): Hits;
}

export interface SearchRequest {
  query?: Query | undefined;
  from?: number;
  limit?: number;
}

export interface IndexStateBase {
  kind: string;
}

export interface Bm25Config {
  k1: number;
  b: number;
}

export const defaultBm25Config = (): Bm25Config => ({ k1: 1.2, b: 0.75 });

export type IndexState = TextFieldIndexState | GeoFieldIndexState | VectorFieldIndexState;

export interface TextFieldIndexState extends IndexStateBase {
  kind: "TextFieldIndexState";
  termCounts: Record<string, number>;
  reverseMap: Record<string, TermPos[]>;
  trie: TrieNodeState;
  rankingAlgorithm: RankingAlgorithm;
  bm25Config: Bm25Config;
}

export interface GeoFieldIndexState extends IndexStateBase {
  kind: "GeoFieldIndexState";
  precision: number;
  geohashMap: Record<string, string[]>;
  documents: Record<string, string>;
}

export interface VectorFieldIndexState extends IndexStateBase {
  kind: "VectorFieldIndexState";
  numHashTables: number;
  dimensions: number;
  vectors: Record<string, Vector[]>;
  randomVectorsList: Vector[][];
}

export interface DocumentIndexState {
  documents: Record<string, Document>;
  fieldState: Record<string, IndexState>;
}

export interface FieldIndex {
  readonly indexState: IndexState;
  loadState(fieldIndexState: IndexState): FieldIndex;
}

export enum RankingAlgorithm {
  TFIDF = "TFIDF",
  BM25 = "BM25"
}

export interface TermPos {
  id: string;
  position: number;
}

export class QueryContext {
  private excludeIds: Set<string> | null = null;
  private includeIds: Set<string> | null = null;

  exclude(ids: string[]): void {
    this.excludeIds ??= new Set();
    ids.forEach((id) => this.excludeIds?.add(id));
  }

  include(ids: string[]): void {
    this.includeIds ??= new Set();
    ids.forEach((id) => this.includeIds?.add(id));
  }

  setIncludeIds(ids: string[]): void {
    this.includeIds = new Set(ids);
  }

  withFilterMode<T>(block: (context: QueryContext) => T): T {
    return block(this);
  }

  hits(): Hits {
    if (!this.includeIds) {
      throw new Error("cannot get hits from uninitialized context");
    }
    return [...this.includeIds]
      .filter((id) => !this.excludeIds?.has(id))
      .map((id): Hit => [id, 1.0]);
  }
}

function normalizedBoost(query: Query): number {
  return query.boost ?? 1.0;
}

function applyBoost(hits: Hits, boost: number): Hits {
  if (boost === 1.0) {
    return hits;
  }
  return hits.map(([id, score]) => [id, score * boost]);
}

export function ids(hits: Hits): string[] {
  return hits.map(([id]) => id);
}

export function andHits(leftHits: Hits, rightHits: Hits): Hits {
  const [left, right] = leftHits.length <= rightHits.length ? [leftHits, rightHits] : [rightHits, leftHits];
  const rightMap = new Map(right);
  return left
    .map(([id, score]) => {
      const rightValue = rightMap.get(id);
      return rightValue == null ? null : ([id, score + rightValue] satisfies Hit);
    })
    .filter((hit): hit is Hit => hit !== null && hit[1] > 0)
    .sort((a, b) => b[1] - a[1]);
}

export function orHits(left: Hits, right: Hits): Hits {
  const collectedHits = new Map<string, number>(left);
  for (const [id, score] of right) {
    collectedHits.set(id, score + (collectedHits.get(id) ?? 0));
  }
  return [...collectedHits.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
}

export class DocumentIndex {
  constructor(
    public readonly mapping: Record<string, FieldIndex>,
    public readonly documents: Record<string, Document> = {}
  ) {}

  get indexState(): DocumentIndexState {
    const fieldState: Record<string, IndexState> = {};
    for (const [key, value] of Object.entries(this.mapping)) {
      fieldState[key] = value.indexState;
    }
    return {
      documents: this.documents,
      fieldState
    };
  }

  loadState(documentIndexState: DocumentIndexState): DocumentIndex {
    const loadedMapping: Record<string, FieldIndex> = {};
    for (const [name, index] of Object.entries(this.mapping)) {
      const state = documentIndexState.fieldState[name];
      loadedMapping[name] = state ? index.loadState(state) : index;
    }
    return new DocumentIndex(loadedMapping, { ...documentIndexState.documents });
  }

  index(document: Document): void {
    this.documents[document.id] = document;
    for (const [field, texts] of Object.entries(document.fields)) {
      let fieldIndex = this.mapping[field];
      if (!fieldIndex) {
        fieldIndex = new TextFieldIndex();
        this.mapping[field] = fieldIndex;
      }
      for (const value of texts) {
        if (fieldIndex instanceof TextFieldIndex) {
          fieldIndex.add(document.id, value);
        } else if (fieldIndex instanceof GeoFieldIndex) {
          fieldIndex.add(document.id, value);
        }
      }
    }
  }

  getFieldIndex(field: string): FieldIndex | undefined {
    return this.mapping[field];
  }

  get(id: string): Document | undefined {
    return this.documents[id];
  }

  search(query: Query, from = 0, limit = 200): Hits {
    const hits = query.hits(this, new QueryContext());
    return hits.slice(from, Math.min(from + limit, hits.length));
  }

  searchRequest({ query = new MatchAll(), from = 0, limit = 200 }: SearchRequest = {}): Hits {
    return this.search(query, from, limit);
  }

  count(request: SearchRequest = {}): number {
    return this.searchRequest(request).length;
  }

  ids(): Set<string> {
    return new Set(Object.keys(this.documents));
  }
}

export class TextFieldIndex implements FieldIndex {
  private readonly termCounts: Map<string, number>;
  private readonly reverseMap: Map<string, TermPos[]>;
  private readonly trie: SimpleStringTrie;

  constructor(
    public readonly analyzer: Analyzer = new Analyzer(),
    public readonly queryAnalyzer: Analyzer = new Analyzer(),
    public readonly rankingAlgorithm: RankingAlgorithm = RankingAlgorithm.TFIDF,
    public readonly bm25Config: Bm25Config = defaultBm25Config(),
    termCounts: Map<string, number> = new Map(),
    reverseMap: Map<string, TermPos[]> = new Map(),
    trie: SimpleStringTrie = new SimpleStringTrie()
  ) {
    this.termCounts = termCounts;
    this.reverseMap = reverseMap;
    this.trie = trie;
  }

  get indexState(): TextFieldIndexState {
    return {
      kind: "TextFieldIndexState",
      termCounts: Object.fromEntries(this.termCounts.entries()),
      reverseMap: Object.fromEntries(
        [...this.reverseMap.entries()].map(([term, positions]) => [term, positions.map((position) => ({ ...position }))])
      ),
      trie: this.trie.root.toState(),
      rankingAlgorithm: this.rankingAlgorithm,
      bm25Config: { ...this.bm25Config }
    };
  }

  loadState(fieldIndexState: IndexState): FieldIndex {
    if (fieldIndexState.kind !== "TextFieldIndexState") {
      throw new Error(`wrong index type; expecting TextFieldIndexState but was ${fieldIndexState.kind}`);
    }
    return new TextFieldIndex(
      this.analyzer,
      this.queryAnalyzer,
      fieldIndexState.rankingAlgorithm,
      fieldIndexState.bm25Config,
      new Map(Object.entries(fieldIndexState.termCounts)),
      new Map(Object.entries(fieldIndexState.reverseMap).map(([term, positions]) => [term, [...positions]])),
      new SimpleStringTrie(new TrieNode(fieldIndexState.trie))
    );
  }

  add(docId: string, text: string): void {
    const tokens = this.analyzer.analyze(text);
    const termPositions = new Map<string, number[]>();
    tokens.forEach((term, index) => {
      const positions = termPositions.get(term) ?? [];
      positions.push(index);
      termPositions.set(term, positions);
    });

    for (const [term, positions] of termPositions.entries()) {
      this.termCounts.set(docId, (this.termCounts.get(docId) ?? 0) + positions.length);
      const existing = this.reverseMap.get(term) ?? [];
      existing.push(...positions.map((position) => ({ id: docId, position })));
      this.reverseMap.set(term, existing);
      this.trie.add(term);
    }
  }

  searchTerm(term: string, allowPrefixMatch = false): Hits {
    const matches = this.termMatches(term) ?? (allowPrefixMatch
      ? [...new Set(this.trie.match(term).flatMap((matchedTerm) => this.termMatches(matchedTerm) ?? []))]
      : null);
    return matches ? this.calculateScore(matches.map((match) => match.id)) : [];
  }

  searchPhrase(terms: string[], slop = 0): Hits {
    if (terms.length === 0) {
      return [];
    }
    const initialMatches = [...(this.reverseMap.get(terms[0]!) ?? [])];
    if (initialMatches.length === 0) {
      return [];
    }
    const phraseMatches: string[] = [];
    for (const { id: docId, position: startPos } of initialMatches) {
      let match = true;
      for (let i = 1; i < terms.length; i += 1) {
        const positions = (this.reverseMap.get(terms[i]!) ?? [])
          .filter((termPos) => termPos.id === docId)
          .map((termPos) => termPos.position);
        const valid = positions.some((pos) => pos === startPos + i || (slop > 0 && pos >= startPos + i - slop && pos <= startPos + i + slop));
        if (!valid) {
          match = false;
          break;
        }
      }
      if (match) {
        phraseMatches.push(docId);
      }
    }
    return this.calculateScore(phraseMatches);
  }

  searchPrefix(prefix: string): Hits {
    const docIds = [...new Set(this.trie.match(prefix).flatMap((term) => (this.termMatches(term) ?? []).map((match) => match.id)))];
    return this.calculateScore(docIds);
  }

  termMatches(term: string): TermPos[] | undefined {
    return this.reverseMap.get(term);
  }

  filterTermsByRange({
    lt,
    lte,
    gt,
    gte
  }: {
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
  }): Hits {
    const lower = gt ?? gte;
    const lowerInclusive = gte != null;
    const upper = lt ?? lte;
    const upperInclusive = lte != null;

    return [...this.reverseMap.keys()]
      .filter((term) => {
        const lowerClause = lower == null ? true : lowerInclusive ? term >= lower : term > lower;
        const upperClause = upper == null ? true : upperInclusive ? term <= upper : term < upper;
        return lowerClause && upperClause;
      })
      .flatMap((term) => this.reverseMap.get(term) ?? [])
      .map((item) => item.id)
      .filter((id, index, values) => values.indexOf(id) === index)
      .map((id): Hit => [id, 1.0]);
  }

  private calculateScore(docIds: string[]): Hits {
    return this.rankingAlgorithm === RankingAlgorithm.TFIDF ? this.calculateTfIdf(docIds) : this.calculateBm25(docIds);
  }

  private calculateTfIdf(docIds: string[]): Hits {
    const termCountsPerDoc = new Map<string, number>();
    const matchedDocs = new Set<string>();
    for (const docId of docIds) {
      termCountsPerDoc.set(docId, (termCountsPerDoc.get(docId) ?? 0) + 1);
      matchedDocs.add(docId);
    }
    const idf = matchedDocs.size === 0 ? 0 : Math.log10(this.termCounts.size / matchedDocs.size);
    return [...termCountsPerDoc.entries()]
      .map(([docId, termCount]): Hit => {
        const wordCount = this.wordCount(docId);
        const tf = wordCount === 0 ? 0 : termCount / wordCount;
        return [docId, tf * idf];
      })
      .sort((a, b) => b[1] - a[1]);
  }

  private calculateBm25(docIds: string[]): Hits {
    const termCountsPerDoc = new Map<string, number>();
    const matchedDocs = new Set<string>();
    for (const docId of docIds) {
      termCountsPerDoc.set(docId, (termCountsPerDoc.get(docId) ?? 0) + 1);
      matchedDocs.add(docId);
    }
    const df = matchedDocs.size;
    const totalDocs = this.termCounts.size;
    const avgDocLength = totalDocs === 0 ? 0 : [...this.termCounts.values()].reduce((sum, value) => sum + value, 0) / totalDocs;
    const idf = df === 0 ? 0 : Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    return [...termCountsPerDoc.entries()]
      .map(([docId, termCount]): Hit => {
        const wordCount = this.wordCount(docId);
        const numerator = termCount * (this.bm25Config.k1 + 1);
        const denominator = termCount + this.bm25Config.k1 * (1 - this.bm25Config.b + this.bm25Config.b * (wordCount / avgDocLength));
        return [docId, denominator === 0 ? 0 : (idf * numerator) / denominator];
      })
      .sort((a, b) => b[1] - a[1]);
  }

  private wordCount(docId: string): number {
    return this.termCounts.get(docId) ?? 0;
  }

  getTopSignificantTerms(n: number, subsetDocIds: Set<string>): Record<string, [number, number]> {
    const subsetTermCounts = new Map<string, number>();
    const subsetTermDocs = new Map<string, Set<string>>();
    for (const docId of subsetDocIds) {
      for (const [term, docIds] of this.reverseMap.entries()) {
        if (docIds.some((entry) => entry.id === docId)) {
          subsetTermCounts.set(term, (subsetTermCounts.get(term) ?? 0) + 1);
          const docs = subsetTermDocs.get(term) ?? new Set<string>();
          docs.add(docId);
          subsetTermDocs.set(term, docs);
        }
      }
    }
    const totalDocs = this.termCounts.size;
    const subsetSize = subsetDocIds.size;
    const backgroundTermCounts = new Map<string, number>([...this.reverseMap.entries()].map(([term, docIds]) => [term, docIds.length]));
    return Object.fromEntries(
      [...subsetTermCounts.entries()]
        .map(([term, subsetCount]) => {
          const subsetFrequency = subsetSize === 0 ? 0 : subsetCount / subsetSize;
          const backgroundFrequency = (backgroundTermCounts.get(term) ?? 0) / (totalDocs || 1);
          const significance = backgroundFrequency > 0 ? subsetFrequency / backgroundFrequency : subsetFrequency;
          const docCount = subsetTermDocs.get(term)?.size ?? 0;
          return [term, [significance, docCount] as [number, number]] as [string, [number, number]];
        })
        .sort((a, b) => b[1][0] - a[1][0])
        .slice(0, n)
    );
  }

  termsAggregation(n: number, subsetDocIds?: Set<string>): Record<string, number> {
    const termCounts = new Map<string, number>();
    if (!subsetDocIds) {
      for (const [term, docIds] of this.reverseMap.entries()) {
        termCounts.set(term, docIds.length);
      }
    } else {
      for (const docId of subsetDocIds) {
        for (const [term, docIds] of this.reverseMap.entries()) {
          if (docIds.some((entry) => entry.id === docId)) {
            termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
          }
        }
      }
    }
    return Object.fromEntries([...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n));
  }
}

export class GeoFieldIndex implements FieldIndex {
  private readonly geohashMap: Map<string, string[]>;
  private readonly documents: Record<string, string>;

  constructor(
    private readonly precision = 5,
    geohashMap: Map<string, string[]> = new Map(),
    documents: Record<string, string> = {}
  ) {
    this.geohashMap = geohashMap;
    this.documents = documents;
  }

  get indexState(): GeoFieldIndexState {
    return {
      kind: "GeoFieldIndexState",
      precision: this.precision,
      geohashMap: Object.fromEntries(this.geohashMap.entries()),
      documents: { ...this.documents }
    };
  }

  loadState(fieldIndexState: IndexState): FieldIndex {
    if (fieldIndexState.kind !== "GeoFieldIndexState") {
      throw new Error(`wrong index type; expecting GeoFieldIndexState but was ${fieldIndexState.kind}`);
    }
    return new GeoFieldIndex(
      fieldIndexState.precision,
      new Map(Object.entries(fieldIndexState.geohashMap).map(([hash, ids]) => [hash, [...ids]])),
      { ...fieldIndexState.documents }
    );
  }

  add(docId: string, geoJson: string): void {
    this.documents[docId] = geoJson;
    const geometry = JSON.parse(geoJson) as Geometry;
    for (const hash of geohashesForGeometry(geometry, this.precision)) {
      const values = this.geohashMap.get(hash) ?? [];
      if (!values.includes(docId)) {
        values.push(docId);
      }
      this.geohashMap.set(hash, values);
    }
  }

  queryPoint(latitude: number, longitude: number): string[] {
    const hash = encodeGeohash(latitude, longitude, this.precision);
    return (this.geohashMap.get(hash) ?? []).filter((id) => {
      const geoJson = this.documents[id];
      return geoJson ? geometryContainsPoint(JSON.parse(geoJson) as Geometry, latitude, longitude) : false;
    });
  }

  queryPolygon(polygon: PolygonCoordinates): string[] {
    const seen = new Set<string>();
    const hits: string[] = [];
    for (const hash of geohashesForGeometry({ type: "Polygon", coordinates: polygon }, this.precision)) {
      for (const id of this.geohashMap.get(hash) ?? []) {
        if (seen.has(id)) {
          continue;
        }
        const geoJson = this.documents[id];
        if (!geoJson) {
          continue;
        }
        const geometry = JSON.parse(geoJson) as Geometry;
        if (geometryIntersectsGeohash(geometry, hash) && geometryIntersectsPolygon(geometry, polygon)) {
          seen.add(id);
          hits.push(id);
        }
      }
    }
    return hits;
  }
}

export type Vector = number[];

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
    const candidates = new Map<string, [string, Vector]>();
    const allowed = filterIds ? new Set(filterIds) : null;
    for (let i = 0; i < this.numHashTables; i += 1) {
      const hash = hashFunction(vector, this.randomVectorsList[i]!);
      const bucket = this.allBuckets[i]!.get(hash) ?? [];
      for (const [id, candidate] of bucket) {
        if (!allowed || allowed.has(id)) {
          candidates.set(`${id}:${candidate.join(",")}`, [id, candidate]);
        }
      }
    }
    return [...candidates.values()]
      .map(([id, candidate]) => [id, cosineSimilarity(vector, candidate)] as Hit)
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }
}

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

export function generateRandomVector(dimensions: number, random: RandomSource = Math.random): Vector {
  return Array.from({ length: dimensions }, () => random());
}

export function normalizeVector(vector: Vector): Vector {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
}

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

export enum OP {
  AND = "AND",
  OR = "OR"
}

export class BoolQuery implements Query {
  constructor(
    private readonly should: Query[] = [],
    private readonly must: Query[] = [],
    private readonly filter: Query[] = [],
    private readonly mustNot: Query[] = [],
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex, context: QueryContext = new QueryContext()): Hits {
    if (this.filter.length === 0 && this.should.length === 0 && this.must.length === 0) {
      throw new Error("should specify at least one of filter, must, or should");
    }

    context.withFilterMode((filterContext) => {
      const excludedHits = this.mustNot.map((query) => query.hits(documentIndex, filterContext));
      context.exclude(excludedHits.length > 0 ? ids(excludedHits.reduce(andHits)) : []);

      const filtered = this.filter.map((query) => query.hits(documentIndex, filterContext));
      if (filtered.length > 0) {
        const reduced = filtered.reduce(andHits);
        context.include(ids(reduced));
      }
    });

    const mustHits = this.must.length === 0 && this.filter.length > 0
      ? context.hits()
      : (() => {
          const mappedMusts = this.must.map((query) => query.hits(documentIndex, context));
          if (mappedMusts.length > 0) {
            return this.filter.length > 0 ? [context.hits(), ...mappedMusts].reduce(andHits) : mappedMusts.reduce(andHits);
          }
          return [];
        })();

    if (this.must.length > 0) {
      context.setIncludeIds(ids(mustHits));
    }

    const mappedShoulds = this.should.map((query) => query.hits(documentIndex, context));
    const shouldHits = mappedShoulds.length > 0 ? mappedShoulds.reduce(orHits) : [];

    let result: Hits;
    if (this.must.length === 0 && this.should.length === 0) {
      result = mustHits;
    } else if (this.filter.length === 0 && this.should.length === 0) {
      result = mustHits;
    } else if (this.must.length === 0 && this.filter.length === 0) {
      result = shouldHits;
    } else if (this.filter.length === 0) {
      result = this.should.length === 0 ? mustHits : this.must.length === 0 ? shouldHits : andHits(mustHits, shouldHits);
    } else {
      result = shouldHits.length === 0 ? mustHits : andHits(mustHits, shouldHits);
    }

    return applyBoost(result, normalizedBoost(this));
  }
}

export class TermQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly text: string,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    const hits = fieldIndex instanceof TextFieldIndex
      ? (fieldIndex.termMatches(this.text) ?? []).map((match): Hit => [match.id, 1.0])
      : [];
    return applyBoost(hits, normalizedBoost(this));
  }
}

export class RangeQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly params: {
      lt?: string;
      lte?: string;
      gt?: string;
      gte?: string;
    } = {},
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    const hits = fieldIndex instanceof TextFieldIndex ? fieldIndex.filterTermsByRange(this.params) : [];
    return applyBoost(hits, normalizedBoost(this));
  }
}

export class MatchQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly text: string,
    private readonly operation: OP = OP.AND,
    private readonly prefixMatch = false,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    if (!(fieldIndex instanceof TextFieldIndex)) {
      return [];
    }
    const searchTerms = fieldIndex.queryAnalyzer.analyze(this.text);
    const collectedHits = new Map<string, number>();

    if (this.operation === OP.AND) {
      const termHits = searchTerms.map((term) => fieldIndex.searchTerm(term, this.prefixMatch)).sort((a, b) => a.length - b.length);
      if (termHits.length === 0 || termHits[0]!.length === 0) {
        return [];
      }
      for (const [id, score] of termHits[0]!) {
        collectedHits.set(id, score);
      }
      for (const hits of termHits.slice(1)) {
        for (const [id, score] of hits) {
          if (collectedHits.has(id)) {
            collectedHits.set(id, score + (collectedHits.get(id) ?? 0));
          }
        }
      }
    } else {
      const termHits = searchTerms.map((term) => fieldIndex.searchTerm(term, this.prefixMatch));
      for (const hits of termHits) {
        for (const [id, score] of hits) {
          collectedHits.set(id, score + (collectedHits.get(id) ?? 0));
        }
      }
    }

    return applyBoost(
      [...collectedHits.entries()].sort((a, b) => b[1] - a[1]),
      normalizedBoost(this)
    );
  }
}

export class MatchPhrase implements Query {
  constructor(
    private readonly field: string,
    private readonly text: string,
    private readonly slop = 0,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    if (!(fieldIndex instanceof TextFieldIndex)) {
      return [];
    }
    const searchTerms = fieldIndex.queryAnalyzer.analyze(this.text);
    return applyBoost(fieldIndex.searchPhrase(searchTerms, this.slop), normalizedBoost(this));
  }
}

export class MatchAll implements Query {
  constructor(public readonly boost: number | undefined = undefined) {}

  hits(documentIndex: DocumentIndex): Hits {
    return applyBoost([...documentIndex.ids()].map((id): Hit => [id, 1.0]), normalizedBoost(this));
  }
}

export class GeoPointQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly latitude: number,
    private readonly longitude: number,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    const hits = fieldIndex instanceof GeoFieldIndex
      ? fieldIndex.queryPoint(this.latitude, this.longitude).map((id): Hit => [id, 1.0])
      : [];
    return applyBoost(hits, normalizedBoost(this));
  }
}

export class GeoPolygonQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly polygon: PolygonCoordinates,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    const hits = fieldIndex instanceof GeoFieldIndex
      ? fieldIndex.queryPolygon(this.polygon).map((id): Hit => [id, 1.0])
      : [];
    return applyBoost(hits, normalizedBoost(this));
  }
}
