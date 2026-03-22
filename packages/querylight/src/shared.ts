import { type TrieNodeState } from "./trie";
import { type VectorFieldIndexState } from "./vector";
import { type DocumentIndex } from "./document-index";

/** Stored document shape used by {@link DocumentIndex}. */
export interface Document {
  id: string;
  fields: Record<string, string[]>;
}

/** `[documentId, score]` tuple returned by search operations. */
export type Hit = [string, number];
/** Ordered list of scored hits. */
export type Hits = Hit[];

/** Highlight clause emitted by queries that support highlighting. */
export interface HighlightClause {
  kind: "term" | "phrase";
  field: string;
  text: string;
  operation?: "AND" | "OR";
  prefixMatch?: boolean;
  slop?: number;
}

/** Highlighted span within a stored field value. */
export interface HighlightSpan {
  startOffset: number;
  endOffset: number;
  term: string;
  kind: "exact" | "phrase" | "prefix" | "fuzzy";
}

/** Plain or highlighted segment within a returned fragment. */
export interface HighlightFragmentPart {
  text: string;
  highlighted: boolean;
}

/** Highlight fragment returned for one stored field value. */
export interface HighlightFragment {
  field: string;
  valueIndex: number;
  text: string;
  parts: HighlightFragmentPart[];
  spans: HighlightSpan[];
}

/** Highlight results for one field. */
export interface HighlightFieldResult {
  field: string;
  fragments: HighlightFragment[];
}

/** Options for `DocumentIndex.highlight(...)`. */
export interface HighlightRequest {
  fields: string[];
  fragmentSize?: number;
  numberOfFragments?: number;
  requireFieldMatch?: boolean;
}

/** Highlight response payload. */
export interface HighlightResult {
  fields: HighlightFieldResult[];
}

/** Minimal query contract implemented by all query classes. */
export interface Query {
  readonly boost: number | undefined;
  hits(documentIndex: DocumentIndex, context?: QueryContext): Hits;
  highlightClauses?(documentIndex: DocumentIndex): HighlightClause[];
}

/** Request object for paginated searching. */
export interface SearchRequest {
  query?: Query | undefined;
  from?: number;
  limit?: number;
}

/** Tuning options for reciprocal rank fusion. */
export interface ReciprocalRankFusionOptions {
  rankConstant?: number;
  weights?: number[];
}

/** Common base type for serialized field index state. */
export interface IndexStateBase {
  kind: string;
}

/** BM25 scoring configuration. */
export interface Bm25Config {
  k1: number;
  b: number;
}

/** Default BM25 configuration used by text indexes. */
export const defaultBm25Config = (): Bm25Config => ({ k1: 1.2, b: 0.75 });

/** Serialized state for {@link TextFieldIndex}. */
export interface TextFieldIndexState extends IndexStateBase {
  kind: "TextFieldIndexState";
  termCounts: Record<string, number>;
  reverseMap: Record<string, TermPos[]>;
  trie: TrieNodeState;
  rankingAlgorithm: RankingAlgorithm;
  bm25Config: Bm25Config;
}

/** Serialized state for {@link GeoFieldIndex}. */
export interface GeoFieldIndexState extends IndexStateBase {
  kind: "GeoFieldIndexState";
  precision: number;
  geohashMap: Record<string, string[]>;
  documents: Record<string, string>;
}

/** Serialized state for {@link NumericFieldIndex}. */
export interface NumericFieldIndexState extends IndexStateBase {
  kind: "NumericFieldIndexState";
  documents: Record<string, number[]>;
}

/** Serialized state for {@link DateFieldIndex}. */
export interface DateFieldIndexState extends IndexStateBase {
  kind: "DateFieldIndexState";
  documents: Record<string, number[]>;
}

/** Aggregate statistics over numeric values. */
export interface NumericStatsAggregation {
  count: number;
  min: number | null;
  max: number | null;
  sum: number;
  avg: number | null;
}

/** One configured bucket in a numeric range aggregation. */
export interface NumericRangeAggregationRange {
  key?: string;
  from?: string | number | Date;
  to?: string | number | Date;
}

/** Materialized numeric range aggregation bucket. */
export interface NumericRangeAggregationBucket {
  key: string;
  from: number | null;
  to: number | null;
  docCount: number;
}

/** Numeric histogram bucket. */
export interface NumericHistogramBucket {
  key: number;
  docCount: number;
}

/** Date histogram bucket. */
export interface DateHistogramBucket {
  key: number;
  keyAsString: string;
  docCount: number;
}

/** Significant-terms bucket comparing subset and background frequency. */
export interface SignificantTermsBucket {
  key: string;
  score: number;
  subsetDocCount: number;
  backgroundDocCount: number;
}

/** Union of all serialized field index state payloads. */
export type IndexState = TextFieldIndexState | GeoFieldIndexState | NumericFieldIndexState | DateFieldIndexState | VectorFieldIndexState;

/** Serialized state for a full {@link DocumentIndex}. */
export interface DocumentIndexState {
  documents: Record<string, Document>;
  fieldState: Record<string, IndexState>;
}

/** Common interface implemented by all field indexes. */
export interface FieldIndex {
  readonly indexState: IndexState;
  loadState(fieldIndexState: IndexState): FieldIndex;
  indexValue?(documentId: string, value: string): void;
}

/** Built-in scoring algorithms for lexical ranking. */
export enum RankingAlgorithm {
  TFIDF = "TFIDF",
  BM25 = "BM25"
}

/** Recorded token position for one document occurrence. */
export interface TermPos {
  id: string;
  position: number;
}

/** Mutable search context used to carry filter/include/exclude state across nested queries. */
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

/** Resolves `undefined` boosts to a neutral multiplier of `1.0`. */
export function normalizedBoost(query: Query): number {
  return query.boost ?? 1.0;
}

/** Applies a multiplicative boost to every hit score. */
export function applyBoost(hits: Hits, boost: number): Hits {
  if (boost === 1.0) {
    return hits;
  }
  return hits.map(([id, score]) => [id, score * boost]);
}

/** Extracts document ids from an ordered hit list. */
export function ids(hits: Hits): string[] {
  return hits.map(([id]) => id);
}

/** Intersects two hit lists and adds scores for matching documents. */
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

/** Unions two hit lists and sums scores for duplicate documents. */
export function orHits(left: Hits, right: Hits): Hits {
  const collectedHits = new Map<string, number>(left);
  for (const [id, score] of right) {
    collectedHits.set(id, score + (collectedHits.get(id) ?? 0));
  }
  return [...collectedHits.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** Combines multiple ranked lists using reciprocal rank fusion. */
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
