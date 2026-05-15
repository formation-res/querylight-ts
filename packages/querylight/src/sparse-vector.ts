import { type Hit, type Hits, type IndexState, type IndexStateBase } from "./shared";

/** Sparse token-weight vector used for learned sparse retrieval. */
export type SparseVector = Record<string, number>;

/** Value-object constructor params for {@link SparseVectorFieldIndex}. */
export interface SparseVectorFieldIndexParams {
  initialVectors?: Record<string, SparseVector[]>;
}

/** Serialized state for {@link SparseVectorFieldIndex}. */
export interface SparseVectorFieldIndexState extends IndexStateBase {
  kind: "SparseVectorFieldIndexState";
  vectors: Record<string, SparseVector[]>;
}

type Posting = {
  id: string;
  vectorIndex: number;
  weight: number;
};

/** Inverted-index sparse vector retrieval using exact inner-product scoring. */
export class SparseVectorFieldIndex {
  private readonly vectors = new Map<string, SparseVector[]>();
  private readonly postings = new Map<string, Posting[]>();

  constructor(params: SparseVectorFieldIndexParams = {}) {
    if (params.initialVectors) {
      for (const [id, vectors] of Object.entries(params.initialVectors)) {
        this.insert(id, vectors);
      }
    }
  }

  get indexState(): SparseVectorFieldIndexState {
    return {
      kind: "SparseVectorFieldIndexState",
      vectors: Object.fromEntries(
        [...this.vectors.entries()].map(([id, vectors]) => [
          id,
          vectors.map((vector) => ({ ...vector }))
        ])
      )
    };
  }

  loadState(fieldIndexState: IndexState): SparseVectorFieldIndex {
    if (fieldIndexState.kind !== "SparseVectorFieldIndexState") {
      throw new Error(`wrong index type; expecting SparseVectorFieldIndexState but was ${fieldIndexState.kind}`);
    }
    return new SparseVectorFieldIndex({
      initialVectors: fieldIndexState.vectors
    });
  }

  insert(id: string, embeddings: SparseVector[]): void {
    const normalizedEmbeddings = embeddings.map(assertValidSparseVector);
    this.removeDocument(id);
    this.vectors.set(id, normalizedEmbeddings);

    normalizedEmbeddings.forEach((vector, vectorIndex) => {
      for (const [token, weight] of Object.entries(vector)) {
        const postings = this.postings.get(token) ?? [];
        postings.push({ id, vectorIndex, weight });
        this.postings.set(token, postings);
      }
    });
  }

  query(vector: SparseVector, k: number, filterIds?: string[]): Hits {
    if (k <= 0) {
      return [];
    }

    const normalizedQuery = assertValidSparseVector(vector);
    const allowed = filterIds ? new Set(filterIds) : null;
    const scoresByVectorKey = new Map<string, number>();

    for (const [token, queryWeight] of Object.entries(normalizedQuery)) {
      const postings = this.postings.get(token);
      if (!postings) {
        continue;
      }
      for (const posting of postings) {
        if (allowed && !allowed.has(posting.id)) {
          continue;
        }
        const vectorKey = `${posting.id}\u0000${posting.vectorIndex}`;
        scoresByVectorKey.set(vectorKey, (scoresByVectorKey.get(vectorKey) ?? 0) + posting.weight * queryWeight);
      }
    }

    return collapseVectorScores(scoresByVectorKey, k);
  }

  rerank(vector: SparseVector, candidateIds: string[], k = candidateIds.length): Hits {
    if (k <= 0) {
      return [];
    }

    const normalizedQuery = assertValidSparseVector(vector);
    const hits: Hits = [];

    for (const id of candidateIds) {
      const candidates = this.vectors.get(id);
      if (!candidates || candidates.length === 0) {
        continue;
      }
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const candidate of candidates) {
        const score = sparseInnerProduct(normalizedQuery, candidate);
        if (score > bestScore) {
          bestScore = score;
        }
      }
      if (bestScore > Number.NEGATIVE_INFINITY) {
        hits.push([id, bestScore]);
      }
    }

    return selectTopHits(hits, k);
  }

  documentVectors(id: string): SparseVector[] {
    return this.vectors.get(id)?.map((vector) => ({ ...vector })) ?? [];
  }

  private removeDocument(id: string): void {
    const existing = this.vectors.get(id);
    if (!existing) {
      return;
    }

    for (const [token, postings] of this.postings.entries()) {
      const filtered = postings.filter((posting) => posting.id !== id);
      if (filtered.length === 0) {
        this.postings.delete(token);
      } else if (filtered.length !== postings.length) {
        this.postings.set(token, filtered);
      }
    }
  }
}

/** Computes the exact sparse inner product between two token-weight vectors. */
export function sparseInnerProduct(left: SparseVector, right: SparseVector): number {
  const [smaller, larger] =
    Object.keys(left).length <= Object.keys(right).length
      ? [left, right]
      : [right, left];

  let score = 0;
  for (const [token, weight] of Object.entries(smaller)) {
    score += weight * (larger[token] ?? 0);
  }
  return score;
}

function assertValidSparseVector(vector: SparseVector): SparseVector {
  const normalized: SparseVector = {};

  for (const [token, weight] of Object.entries(vector)) {
    if (!token) {
      throw new Error("Sparse vectors must not contain empty token keys");
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("Sparse vector weights must be finite numbers greater than or equal to 0");
    }
    if (weight > 0) {
      normalized[token] = weight;
    }
  }

  return normalized;
}

function collapseVectorScores(scoresByVectorKey: Map<string, number>, k: number): Hits {
  const scoresByDocument = new Map<string, number>();
  for (const [vectorKey, score] of scoresByVectorKey.entries()) {
    const separator = vectorKey.indexOf("\u0000");
    const id = separator === -1 ? vectorKey : vectorKey.slice(0, separator);
    const previous = scoresByDocument.get(id) ?? Number.NEGATIVE_INFINITY;
    if (score > previous) {
      scoresByDocument.set(id, score);
    }
  }
  return selectTopHits(scoresByDocument, k);
}

function selectTopHits(source: Map<string, number> | Hits, k: number): Hits {
  const hits = source instanceof Map ? [...source.entries()].map(([id, score]) => [id, score] as Hit) : [...source];
  if (k <= 0) {
    return [];
  }
  return hits.sort((left, right) => right[1] - left[1]).slice(0, k);
}
