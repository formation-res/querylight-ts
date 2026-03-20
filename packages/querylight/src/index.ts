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

export interface SimpleTextSearchRequest {
  query: string;
  from?: number;
  limit?: number;
}

export interface CreateSimpleTextSearchIndexOptions<T extends Record<string, unknown>> {
  documents: T[];
  primaryFields: (Extract<keyof T, string>)[];
  secondaryFields?: (Extract<keyof T, string>)[];
  idField?: Extract<keyof T, string>;
  ranking?: RankingAlgorithm;
}

export interface SimpleTextSearchIndex<T extends Record<string, unknown> = Record<string, unknown>> {
  documentIndex: DocumentIndex;
  fuzzyIndex: DocumentIndex;
  documents: T[];
  documentsById: Map<string, T>;
  idField: string;
  primaryFields: string[];
  secondaryFields: string[];
  ranking: RankingAlgorithm;
  primarySuggestField: string;
  secondarySuggestField: string;
  fuzzyField: string;
}

export interface ReciprocalRankFusionOptions {
  rankConstant?: number;
  weights?: number[];
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
  indexValue?(documentId: string, value: string): void;
}

export enum RankingAlgorithm {
  TFIDF = "TFIDF",
  BM25 = "BM25"
}

export interface TermPos {
  id: string;
  position: number;
}

interface RankingStrategy {
  score(index: TextFieldIndex, docIds: string[]): Hits;
}

class TfIdfRankingStrategy implements RankingStrategy {
  score(index: TextFieldIndex, docIds: string[]): Hits {
    const termCountsPerDoc = countTermsPerDoc(docIds);
    const matchedDocs = new Set(termCountsPerDoc.keys());
    const idf = matchedDocs.size === 0 ? 0 : Math.log10(index.documentCount / matchedDocs.size);
    return [...termCountsPerDoc.entries()]
      .map(([docId, termCount]): Hit => {
        const wordCount = index.wordCount(docId);
        const tf = wordCount === 0 ? 0 : termCount / wordCount;
        return [docId, tf * idf];
      })
      .sort((a, b) => b[1] - a[1]);
  }
}

class Bm25RankingStrategy implements RankingStrategy {
  score(index: TextFieldIndex, docIds: string[]): Hits {
    const termCountsPerDoc = countTermsPerDoc(docIds);
    const df = termCountsPerDoc.size;
    const totalDocs = index.documentCount;
    const avgDocLength = totalDocs === 0 ? 0 : index.totalIndexedTermCount / totalDocs;
    const idf = df === 0 ? 0 : Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    return [...termCountsPerDoc.entries()]
      .map(([docId, termCount]): Hit => {
        const wordCount = index.wordCount(docId);
        const numerator = termCount * (index.bm25Config.k1 + 1);
        const denominator = termCount + index.bm25Config.k1 * (1 - index.bm25Config.b + index.bm25Config.b * (wordCount / avgDocLength));
        return [docId, denominator === 0 ? 0 : (idf * numerator) / denominator];
      })
      .sort((a, b) => b[1] - a[1]);
  }
}

function rankingStrategyFor(algorithm: RankingAlgorithm): RankingStrategy {
  return algorithm === RankingAlgorithm.BM25 ? new Bm25RankingStrategy() : new TfIdfRankingStrategy();
}

function countTermsPerDoc(docIds: string[]): Map<string, number> {
  const termCountsPerDoc = new Map<string, number>();
  for (const docId of docIds) {
    termCountsPerDoc.set(docId, (termCountsPerDoc.get(docId) ?? 0) + 1);
  }
  return termCountsPerDoc;
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

function textFieldHits(documentIndex: DocumentIndex, field: string, block: (fieldIndex: TextFieldIndex) => Hits): Hits {
  const fieldIndex = documentIndex.getFieldIndex(field);
  return fieldIndex instanceof TextFieldIndex ? block(fieldIndex) : [];
}

function geoFieldHits(documentIndex: DocumentIndex, field: string, block: (fieldIndex: GeoFieldIndex) => Hits): Hits {
  const fieldIndex = documentIndex.getFieldIndex(field);
  return fieldIndex instanceof GeoFieldIndex ? block(fieldIndex) : [];
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

export function reciprocalRankFusion(
  rankings: Hits[],
  { rankConstant = 60, weights = [] }: ReciprocalRankFusionOptions = {}
): Hits {
  if (!Number.isFinite(rankConstant) || rankConstant < 0) {
    throw new Error("rankConstant should be a finite number >= 0");
  }
  if (weights.length > rankings.length) {
    throw new Error("weights cannot be longer than rankings");
  }

  const scores = new Map<string, number>();
  const firstSeen = new Map<string, number>();

  rankings.forEach((ranking, rankingIndex) => {
    const weight = weights[rankingIndex] ?? 1.0;
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("weights should be finite numbers >= 0");
    }
    ranking.forEach(([id], rankIndex) => {
      firstSeen.set(id, Math.min(firstSeen.get(id) ?? Number.POSITIVE_INFINITY, rankIndex));
      scores.set(id, (scores.get(id) ?? 0) + weight / (rankConstant + rankIndex + 1));
    });
  });

  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => {
      const scoreDelta = b[1] - a[1];
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const firstSeenDelta = (firstSeen.get(a[0]) ?? Number.POSITIVE_INFINITY) - (firstSeen.get(b[0]) ?? Number.POSITIVE_INFINITY);
      if (firstSeenDelta !== 0) {
        return firstSeenDelta;
      }
      return a[0].localeCompare(b[0]);
    });
}

const SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD = "__simpleTextSearchPrimarySuggest";
const SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD = "__simpleTextSearchSecondarySuggest";
const SIMPLE_TEXT_SEARCH_FUZZY_FIELD = "__simpleTextSearchFuzzy";

function parseSimpleTextSearchInput(rawQuery: string): { queryText: string; quotedPhrase: string | null } {
  const quotedPhrase = rawQuery.match(/"([^"]+)"/)?.[1] ?? null;
  return {
    queryText: rawQuery.replace(/"/g, "").trim(),
    quotedPhrase
  };
}

function coerceSearchableFieldValue(document: Record<string, unknown>, field: string): string[] {
  const value = document[field];
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error(`field '${field}' should be a string or string[]`);
}

function ensureFieldList(name: string, fields: string[]): void {
  if (fields.length === 0) {
    throw new Error(`${name} should contain at least one field`);
  }
}

export function createSimpleTextSearchIndex<T extends Record<string, unknown>>(
  {
    documents,
    primaryFields,
    secondaryFields = [],
    idField = "id" as Extract<keyof T, string>,
    ranking = RankingAlgorithm.BM25
  }: CreateSimpleTextSearchIndexOptions<T>
): SimpleTextSearchIndex<T> {
  const normalizedPrimaryFields = [...new Set(primaryFields.map((field) => String(field)))];
  const normalizedSecondaryFields = [...new Set(
    secondaryFields
      .map((field) => String(field))
      .filter((field) => !normalizedPrimaryFields.includes(field))
  )];
  ensureFieldList("primaryFields", normalizedPrimaryFields);

  const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 10)]);
  const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
  const documentIndex = new DocumentIndex({
    ...Object.fromEntries(
      [...normalizedPrimaryFields, ...normalizedSecondaryFields].map((field) => [field, new TextFieldIndex(undefined, undefined, ranking)])
    ),
    [SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD]: new TextFieldIndex(edgeAnalyzer, edgeAnalyzer, ranking),
    [SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD]: new TextFieldIndex(edgeAnalyzer, edgeAnalyzer, ranking)
  });
  const fuzzyIndex = new DocumentIndex({
    [SIMPLE_TEXT_SEARCH_FUZZY_FIELD]: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, ranking)
  });
  const documentsById = new Map<string, T>();

  for (const document of documents) {
    const rawId = document[String(idField)];
    if (typeof rawId !== "string" || rawId.length === 0) {
      throw new Error(`id field '${String(idField)}' should be a non-empty string`);
    }

    const fields: Record<string, string[]> = {};
    const primaryTexts = normalizedPrimaryFields.flatMap((field) => {
      const values = coerceSearchableFieldValue(document, field);
      fields[field] = values;
      return values;
    });
    const secondaryTexts = normalizedSecondaryFields.flatMap((field) => {
      const values = coerceSearchableFieldValue(document, field);
      fields[field] = values;
      return values;
    });

    fields[SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD] = [primaryTexts.join(" ")];
    fields[SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD] = [secondaryTexts.join(" ")];
    documentIndex.index({ id: rawId, fields });
    fuzzyIndex.index({
      id: rawId,
      fields: {
        [SIMPLE_TEXT_SEARCH_FUZZY_FIELD]: [[...primaryTexts, ...secondaryTexts].join(" ")]
      }
    });
    documentsById.set(rawId, document);
  }

  return {
    documentIndex,
    fuzzyIndex,
    documents: [...documents],
    documentsById,
    idField: String(idField),
    primaryFields: normalizedPrimaryFields,
    secondaryFields: normalizedSecondaryFields,
    ranking,
    primarySuggestField: SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD,
    secondarySuggestField: SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD,
    fuzzyField: SIMPLE_TEXT_SEARCH_FUZZY_FIELD
  };
}

export function simpleTextSearch<T extends Record<string, unknown>>(
  index: SimpleTextSearchIndex<T>,
  { query, from = 0, limit = 20 }: SimpleTextSearchRequest
): Hits {
  const { queryText, quotedPhrase } = parseSimpleTextSearchInput(query);
  const trimmed = queryText.trim();
  if (trimmed.length === 0 || limit <= 0) {
    return [];
  }

  const branchLimit = Math.max(20, from + limit * 3);
  const phraseText = quotedPhrase ?? trimmed;
  const lexicalQuery = new BoolQuery([
    ...index.primaryFields.map((field) => new MatchPhrase(field, phraseText, quotedPhrase ? 0 : 1, 8)),
    ...index.secondaryFields.map((field) => new MatchPhrase(field, phraseText, quotedPhrase ? 1 : 2, 3)),
    ...index.primaryFields.map((field) => new MatchQuery(field, trimmed, OP.AND, false, 6)),
    ...index.secondaryFields.map((field) => new MatchQuery(field, trimmed, OP.AND, false, 2.5)),
    new MatchQuery(index.primarySuggestField, trimmed, OP.OR, true, 4),
    ...(index.secondaryFields.length > 0 ? [new MatchQuery(index.secondarySuggestField, trimmed, OP.OR, true, 2)] : [])
  ]);
  const lexicalHits = index.documentIndex.searchRequest({ query: lexicalQuery, limit: branchLimit });
  const fuzzyHits = index.fuzzyIndex.searchRequest({
    query: new MatchQuery(index.fuzzyField, trimmed, OP.OR, false, 1.5),
    limit: branchLimit
  });
  const fusedHits = reciprocalRankFusion([lexicalHits, fuzzyHits], { rankConstant: 20, weights: [3, 1] });
  return fusedHits.slice(from, Math.min(from + limit, fusedHits.length));
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
        fieldIndex.indexValue?.(document.id, value);
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
  private readonly termDocPositions: Map<string, Map<string, number[]>>;
  private readonly trie: SimpleStringTrie;
  private readonly rankingStrategy: RankingStrategy;
  private totalTermCount: number;

  constructor(
    public readonly analyzer: Analyzer = new Analyzer(),
    public readonly queryAnalyzer: Analyzer = new Analyzer(),
    public readonly rankingAlgorithm: RankingAlgorithm = RankingAlgorithm.TFIDF,
    public readonly bm25Config: Bm25Config = defaultBm25Config(),
    termCounts: Map<string, number> = new Map(),
    reverseMap: Map<string, TermPos[]> = new Map(),
    termDocPositions: Map<string, Map<string, number[]>> = new Map(),
    totalTermCount = 0,
    trie: SimpleStringTrie = new SimpleStringTrie()
  ) {
    this.termCounts = termCounts;
    this.reverseMap = reverseMap;
    this.termDocPositions = termDocPositions;
    this.totalTermCount = totalTermCount;
    this.trie = trie;
    this.rankingStrategy = rankingStrategyFor(this.rankingAlgorithm);
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
      createTermDocPositions(fieldIndexState.reverseMap),
      [...Object.values(fieldIndexState.termCounts)].reduce((sum, count) => sum + count, 0),
      new SimpleStringTrie(new TrieNode(fieldIndexState.trie))
    );
  }

  add(docId: string, text: string): void {
    const tokens = this.analyzer.analyze(text);
    this.totalTermCount += tokens.length;
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
      const docPositions = this.termDocPositions.get(term) ?? new Map<string, number[]>();
      docPositions.set(docId, [...(docPositions.get(docId) ?? []), ...positions]);
      this.termDocPositions.set(term, docPositions);
      this.trie.add(term);
    }
  }

  indexValue(docId: string, value: string): void {
    this.add(docId, value);
  }

  searchTerm(term: string, allowPrefixMatch = false): Hits {
    const directMatches = this.termMatches(term);
    if (directMatches) {
      return this.calculateScore(directMatches.map((match) => match.id));
    }
    if (!allowPrefixMatch) {
      return [];
    }
    const docIds = new Set<string>();
    for (const matchedTerm of this.trie.match(term)) {
      for (const match of this.termMatches(matchedTerm) ?? []) {
        docIds.add(match.id);
      }
    }
    return docIds.size > 0 ? this.calculateScore([...docIds]) : [];
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
        const positions = this.termDocPositions.get(terms[i]!)?.get(docId) ?? [];
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
    return this.rankingStrategy.score(this, docIds);
  }

  get documentCount(): number {
    return this.termCounts.size;
  }

  get totalIndexedTermCount(): number {
    return this.totalTermCount;
  }

  wordCount(docId: string): number {
    return this.termCounts.get(docId) ?? 0;
  }

  getTopSignificantTerms(n: number, subsetDocIds: Set<string>): Record<string, [number, number]> {
    const totalDocs = this.termCounts.size;
    const subsetSize = subsetDocIds.size;
    return Object.fromEntries(
      [...this.termDocPositions.entries()]
        .map(([term, docPositions]) => {
          const docCount = countDocsInSubset(docPositions, subsetDocIds);
          if (docCount === 0) {
            return null;
          }
          const backgroundCount = docPositions.size;
          const subsetCount = docCount;
          const subsetFrequency = subsetSize === 0 ? 0 : subsetCount / subsetSize;
          const backgroundFrequency = backgroundCount / (totalDocs || 1);
          const significance = backgroundFrequency > 0 ? subsetFrequency / backgroundFrequency : subsetFrequency;
          return [term, [significance, docCount] as [number, number]] as [string, [number, number]];
        })
        .filter((entry): entry is [string, [number, number]] => entry !== null)
        .sort((a, b) => b[1][0] - a[1][0])
        .slice(0, n)
    );
  }

  termsAggregation(n: number, subsetDocIds?: Set<string>): Record<string, number> {
    const termCounts = new Map<string, number>();
    if (!subsetDocIds) {
      for (const [term, docPositions] of this.termDocPositions.entries()) {
        termCounts.set(term, docPositions.size);
      }
    } else {
      for (const [term, docPositions] of this.termDocPositions.entries()) {
        const count = countDocsInSubset(docPositions, subsetDocIds);
        if (count > 0) {
          termCounts.set(term, count);
        }
      }
    }
    return Object.fromEntries([...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n));
  }
}

function createTermDocPositions(reverseMap: Record<string, TermPos[]>): Map<string, Map<string, number[]>> {
  const termDocPositions = new Map<string, Map<string, number[]>>();
  for (const [term, positions] of Object.entries(reverseMap)) {
    const docPositions = new Map<string, number[]>();
    for (const { id, position } of positions) {
      const existing = docPositions.get(id) ?? [];
      existing.push(position);
      docPositions.set(id, existing);
    }
    termDocPositions.set(term, docPositions);
  }
  return termDocPositions;
}

function countDocsInSubset(docPositions: Map<string, number[]>, subsetDocIds: Set<string>): number {
  if (subsetDocIds.size === 0 || docPositions.size === 0) {
    return 0;
  }
  if (subsetDocIds.size < docPositions.size) {
    let count = 0;
    for (const docId of subsetDocIds) {
      if (docPositions.has(docId)) {
        count += 1;
      }
    }
    return count;
  }
  let count = 0;
  for (const docId of docPositions.keys()) {
    if (subsetDocIds.has(docId)) {
      count += 1;
    }
  }
  return count;
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

  indexValue(docId: string, value: string): void {
    this.add(docId, value);
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
    if (this.filter.length === 0 && this.should.length === 0 && this.must.length === 0 && this.mustNot.length === 0) {
      throw new Error("should specify at least one of filter, must, or should");
    }

    context.withFilterMode((filterContext) => {
      const excludedHits = this.mustNot.map((query) => query.hits(documentIndex, filterContext));
      context.exclude(excludedHits.length > 0 ? ids(excludedHits.reduce(orHits)) : []);

      const filtered = this.filter.map((query) => query.hits(documentIndex, filterContext));
      if (filtered.length > 0) {
        const reduced = filtered.reduce(andHits);
        context.include(ids(reduced));
      }
    });

    if (this.filter.length === 0 && this.should.length === 0 && this.must.length === 0 && this.mustNot.length > 0) {
      context.setIncludeIds([...documentIndex.ids()]);
      return applyBoost(context.hits(), normalizedBoost(this));
    }

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
    const hits = textFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => (fieldIndex.termMatches(this.text) ?? []).map((match): Hit => [match.id, 1.0])
    );
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
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => fieldIndex.filterTermsByRange(this.params));
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
    const hits = textFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => {
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
          for (const nextHits of termHits.slice(1)) {
            const hitMap = new Map(nextHits);
            for (const [id, score] of [...collectedHits.entries()]) {
              const nextScore = hitMap.get(id);
              if (nextScore == null) {
                collectedHits.delete(id);
                continue;
              }
              collectedHits.set(id, score + nextScore);
            }
          }
        } else {
          const termHits = searchTerms.map((term) => fieldIndex.searchTerm(term, this.prefixMatch));
          for (const nextHits of termHits) {
            for (const [id, score] of nextHits) {
              collectedHits.set(id, score + (collectedHits.get(id) ?? 0));
            }
          }
        }

        return [...collectedHits.entries()].sort((a, b) => b[1] - a[1]);
      }
    );
    return applyBoost(hits, normalizedBoost(this));
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
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => {
      const searchTerms = fieldIndex.queryAnalyzer.analyze(this.text);
      return fieldIndex.searchPhrase(searchTerms, this.slop);
    });
    return applyBoost(hits, normalizedBoost(this));
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
    const hits = geoFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => fieldIndex.queryPoint(this.latitude, this.longitude).map((id): Hit => [id, 1.0])
    );
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
    const hits = geoFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => fieldIndex.queryPolygon(this.polygon).map((id): Hit => [id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }
}
