import { type TrieNodeState } from "./trie";
import { type VectorFieldIndexState } from "./vector";
import { type DocumentIndex } from "./document-index";

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

export type IndexState = TextFieldIndexState | GeoFieldIndexState | VectorFieldIndexState;

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

export function normalizedBoost(query: Query): number {
  return query.boost ?? 1.0;
}

export function applyBoost(hits: Hits, boost: number): Hits {
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
