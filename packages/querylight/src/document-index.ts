import { Analyzer } from "./analysis";
import {
  encodeGeohash,
  type Geometry,
  geohashesForGeometry,
  type PolygonCoordinates,
  geometryContainsPoint,
  geometryIntersectsGeohash,
  geometryIntersectsPolygon
} from "./geo";
import {
  type Bm25Config,
  type Document,
  type DocumentIndexState,
  type FieldIndex,
  type GeoFieldIndexState,
  type Hit,
  type Hits,
  type IndexState,
  QueryContext,
  RankingAlgorithm,
  type SearchRequest,
  type TermPos,
  type TextFieldIndexState,
  defaultBm25Config
} from "./shared";
import { SimpleStringTrie, TrieNode } from "./trie";

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

  search(query: { hits(documentIndex: DocumentIndex, context?: QueryContext): Hits }, from = 0, limit = 200): Hits {
    const hits = query.hits(this, new QueryContext());
    return hits.slice(from, Math.min(from + limit, hits.length));
  }

  searchRequest({ query, from = 0, limit = 200 }: SearchRequest = {}): Hits {
    const hits = query ? this.search(query, 0, Number.MAX_SAFE_INTEGER) : [...this.ids()].map((id): Hit => [id, 1.0]);
    return hits.slice(from, Math.min(from + limit, hits.length));
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
