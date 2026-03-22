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
  type DateHistogramBucket,
  type Document,
  type DocumentIndexState,
  type FieldIndex,
  type DateFieldIndexState,
  type GeoFieldIndexState,
  type HighlightClause,
  type HighlightFieldResult,
  type HighlightFragment,
  type HighlightRequest,
  type HighlightResult,
  type HighlightSpan,
  type Hit,
  type Hits,
  type IndexState,
  type NumericHistogramBucket,
  type NumericRangeAggregationBucket,
  type NumericRangeAggregationRange,
  type NumericStatsAggregation,
  type NumericFieldIndexState,
  type SignificantTermsBucket,
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

function parseNumericValue(value: string | number | Date): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  const asDate = Date.parse(value);
  return Number.isFinite(asDate) ? asDate : undefined;
}

function filterNumericRange(
  documents: Record<string, number[]>,
  {
    lt,
    lte,
    gt,
    gte
  }: {
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
  }
): Hits {
  const lower = gt ?? gte;
  const lowerValue = lower == null ? undefined : parseNumericValue(lower);
  const lowerInclusive = gte != null;
  const upper = lt ?? lte;
  const upperValue = upper == null ? undefined : parseNumericValue(upper);
  const upperInclusive = lte != null;

  return Object.entries(documents)
    .filter(([, values]) => values.some((value) => {
      const lowerClause = lowerValue == null ? true : lowerInclusive ? value >= lowerValue : value > lowerValue;
      const upperClause = upperValue == null ? true : upperInclusive ? value <= upperValue : value < upperValue;
      return lowerClause && upperClause;
    }))
    .map(([id]): Hit => [id, 1.0]);
}

function valuesForSubset(documents: Record<string, number[]>, subsetDocIds?: Set<string>): number[] {
  const entries = subsetDocIds
    ? [...subsetDocIds].map((docId) => [docId, documents[docId] ?? []] as const)
    : Object.entries(documents);
  return entries.flatMap(([, values]) => values);
}

function docEntriesForSubset(documents: Record<string, number[]>, subsetDocIds?: Set<string>): Array<[string, number[]]> {
  return subsetDocIds
    ? [...subsetDocIds]
      .filter((docId) => (documents[docId] ?? []).length > 0)
      .map((docId) => [docId, documents[docId] ?? []] as [string, number[]])
    : Object.entries(documents).filter(([, values]) => values.length > 0);
}

function computeNumericStats(values: number[]): NumericStatsAggregation {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      sum: 0,
      avg: null
    };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;

  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }

  return {
    count: values.length,
    min,
    max,
    sum,
    avg: sum / values.length
  };
}

function normalizeAggregationBound(value: string | number | Date | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = parseNumericValue(value);
  if (parsed == null) {
    throw new Error(`could not parse aggregation bound: ${String(value)}`);
  }
  return parsed;
}

function defaultRangeBucketKey(from: number | null, to: number | null): string {
  if (from == null && to == null) {
    return "*";
  }
  if (from == null) {
    return `*-${to}`;
  }
  if (to == null) {
    return `${from}-*`;
  }
  return `${from}-${to}`;
}

function createRangeBuckets(
  documents: Record<string, number[]>,
  ranges: NumericRangeAggregationRange[],
  subsetDocIds?: Set<string>
): NumericRangeAggregationBucket[] {
  const normalizedRanges = ranges.map((range) => {
    const from = normalizeAggregationBound(range.from);
    const to = normalizeAggregationBound(range.to);
    return {
      key: range.key ?? defaultRangeBucketKey(from, to),
      from,
      to
    };
  });

  const buckets = normalizedRanges.map((range) => ({
    ...range,
    docCount: 0
  }));

  for (const [, values] of docEntriesForSubset(documents, subsetDocIds)) {
    buckets.forEach((bucket) => {
      const matches = values.some((value) =>
        (bucket.from == null || value >= bucket.from) &&
        (bucket.to == null || value < bucket.to)
      );
      if (matches) {
        bucket.docCount += 1;
      }
    });
  }

  return buckets;
}

function createHistogramBuckets(
  documents: Record<string, number[]>,
  interval: number,
  subsetDocIds?: Set<string>
): NumericHistogramBucket[] {
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error("histogram interval should be a finite number > 0");
  }

  const bucketCounts = new Map<number, number>();

  for (const [, values] of docEntriesForSubset(documents, subsetDocIds)) {
    const keys = new Set(values.map((value) => Math.floor(value / interval) * interval));
    for (const key of keys) {
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }
  }

  return [...bucketCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, docCount]) => ({ key, docCount }));
}

function createDateHistogramBuckets(
  documents: Record<string, number[]>,
  intervalMs: number,
  subsetDocIds?: Set<string>
): DateHistogramBucket[] {
  return createHistogramBuckets(documents, intervalMs, subsetDocIds)
    .map(({ key, docCount }) => ({
      key,
      keyAsString: new Date(key).toISOString(),
      docCount
    }));
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

function mergeSpans(spans: HighlightSpan[]): HighlightSpan[] {
  const sorted = spans.slice().sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
  const merged: HighlightSpan[] = [];
  for (const span of sorted) {
    const previous = merged.at(-1);
    if (!previous || span.startOffset > previous.endOffset) {
      merged.push({ ...span });
      continue;
    }
    previous.endOffset = Math.max(previous.endOffset, span.endOffset);
    previous.term = previous.term.length >= span.term.length ? previous.term : span.term;
    previous.kind = previous.kind === "phrase" || span.kind === "phrase" ? "phrase" : previous.kind;
  }
  return merged;
}

function createHighlightFragments(
  field: string,
  valueIndex: number,
  value: string,
  spans: HighlightSpan[],
  fragmentSize: number
): HighlightFragment[] {
  return spans.map((span) => {
    const fragmentStart = Math.max(0, Math.min(span.startOffset, Math.max(0, span.startOffset - Math.floor((fragmentSize - (span.endOffset - span.startOffset)) / 2))));
    const fragmentEnd = Math.min(value.length, Math.max(span.endOffset, fragmentStart + fragmentSize));
    const containedSpans = spans
      .filter((candidate) => candidate.startOffset < fragmentEnd && candidate.endOffset > fragmentStart)
      .map((candidate) => ({
        ...candidate,
        startOffset: Math.max(candidate.startOffset, fragmentStart),
        endOffset: Math.min(candidate.endOffset, fragmentEnd)
      }));
    const text = value.slice(fragmentStart, fragmentEnd);
    return {
      field,
      valueIndex,
      text,
      spans: containedSpans.map((candidate) => ({
        ...candidate,
        startOffset: candidate.startOffset - fragmentStart,
        endOffset: candidate.endOffset - fragmentStart
      })),
      parts: createFragmentParts(text, containedSpans.map((candidate) => ({
        ...candidate,
        startOffset: candidate.startOffset - fragmentStart,
        endOffset: candidate.endOffset - fragmentStart
      })))
    };
  });
}

function createFragmentParts(text: string, spans: HighlightSpan[]) {
  const parts: HighlightFragment["parts"] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.startOffset > cursor) {
      parts.push({ text: text.slice(cursor, span.startOffset), highlighted: false });
    }
    if (span.endOffset > span.startOffset) {
      parts.push({ text: text.slice(span.startOffset, span.endOffset), highlighted: true });
    }
    cursor = Math.max(cursor, span.endOffset);
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false });
  }
  return parts.filter((part) => part.text.length > 0);
}

/** Top-level document store that coordinates field indexes, search, highlighting, and serialization. */
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

  async search(query: { hits(documentIndex: DocumentIndex, context?: QueryContext): Promise<Hits> }, from = 0, limit = 200): Promise<Hits> {
    const hits = await query.hits(this, new QueryContext());
    return hits.slice(from, Math.min(from + limit, hits.length));
  }

  async searchRequest({ query, from = 0, limit = 200 }: SearchRequest = {}): Promise<Hits> {
    const hits = query ? await this.search(query, 0, Number.MAX_SAFE_INTEGER) : [...this.ids()].map((id): Hit => [id, 1.0]);
    return hits.slice(from, Math.min(from + limit, hits.length));
  }

  highlight(id: string, query: SearchRequest["query"], {
    fields,
    fragmentSize = 160,
    numberOfFragments = 1,
    requireFieldMatch = true
  }: HighlightRequest): HighlightResult {
    const document = this.get(id);
    if (!document || !query?.highlightClauses) {
      return { fields: [] };
    }

    const clauses = query.highlightClauses(this);
    const fieldResults: HighlightFieldResult[] = [];
    for (const field of fields) {
      const fieldIndex = this.getFieldIndex(field);
      if (!(fieldIndex instanceof TextFieldIndex)) {
        continue;
      }
      const matchingClauses = requireFieldMatch ? clauses.filter((clause) => clause.field === field) : clauses;
      if (matchingClauses.length === 0) {
        continue;
      }
      const values = document.fields[field] ?? [];
      const fragments = values.flatMap((value, valueIndex) =>
        fieldIndex.highlightValue(field, valueIndex, value, matchingClauses, fragmentSize, numberOfFragments)
      );
      if (fragments.length > 0) {
        fieldResults.push({ field, fragments });
      }
    }

    return { fields: fieldResults };
  }

  async count(request: SearchRequest = {}): Promise<number> {
    return (await this.searchRequest(request)).length;
  }

  ids(): Set<string> {
    return new Set(Object.keys(this.documents));
  }
}

/** Lexical field index with analyzers, ranking, phrase matching, prefix lookup, and aggregations. */
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

  terms(): string[] {
    return [...this.reverseMap.keys()];
  }

  highlightValue(
    field: string,
    valueIndex: number,
    value: string,
    clauses: HighlightClause[],
    fragmentSize: number,
    numberOfFragments: number
  ): HighlightFragment[] {
    const tokens = this.analyzer.analyzeWithOffsets(value);
    if (tokens.length === 0) {
      return [];
    }

    const spans = mergeSpans(clauses.flatMap((clause) => this.highlightClause(tokens, clause)));
    if (spans.length === 0) {
      return [];
    }

    const fragments = createHighlightFragments(field, valueIndex, value, spans, fragmentSize);
    return fragments.slice(0, numberOfFragments);
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

  private highlightClause(tokens: ReturnType<Analyzer["analyzeWithOffsets"]>, clause: HighlightClause): HighlightSpan[] {
    const queryTerms = this.queryAnalyzer.analyze(clause.text);
    if (queryTerms.length === 0) {
      return [];
    }

    if (clause.kind === "phrase") {
      return this.highlightPhrase(tokens, queryTerms, clause.slop ?? 0);
    }

    const usesApproximateMatching = this.analyzer.tokenFilters.length > 0 || this.queryAnalyzer.tokenFilters.length > 0;
    const matchesPerTerm = queryTerms.map((term) => tokens
      .filter((token) => clause.prefixMatch
        ? token.term.startsWith(term)
        : token.term === term || (usesApproximateMatching && token.term.includes(term)))
      .map((token) => ({ token, matchedTerm: term })));
    if (clause.operation === "AND" && matchesPerTerm.some((matches) => matches.length === 0)) {
      return [];
    }

    return mergeSpans(matchesPerTerm.flat().map(({ token, matchedTerm }) => ({
      startOffset: token.startOffset,
      endOffset: token.endOffset,
      term: token.term,
      kind: clause.prefixMatch
        ? token.term === matchedTerm ? "exact" : "prefix"
        : token.term === matchedTerm ? "exact" : "fuzzy"
    })));
  }

  private highlightPhrase(tokens: ReturnType<Analyzer["analyzeWithOffsets"]>, queryTerms: string[], slop: number): HighlightSpan[] {
    const spans: HighlightSpan[] = [];
    for (let start = 0; start < tokens.length; start += 1) {
      let tokenIndex = start;
      let matched = true;
      for (const term of queryTerms) {
        let found = false;
        const maxIndex = Math.min(tokens.length - 1, tokenIndex + Math.max(1, slop + 1));
        for (let candidate = tokenIndex; candidate <= maxIndex; candidate += 1) {
          if (tokens[candidate]?.term === term) {
            tokenIndex = candidate + 1;
            found = true;
            break;
          }
        }
        if (!found) {
          matched = false;
          break;
        }
      }
      if (!matched) {
        continue;
      }
      const matchedTokens = tokens.slice(start, tokenIndex);
      spans.push({
        startOffset: matchedTokens[0]!.startOffset,
        endOffset: matchedTokens[matchedTokens.length - 1]!.endOffset,
        term: matchedTokens.map((token) => token.term).join(" "),
        kind: "phrase"
      });
    }
    return mergeSpans(spans);
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

  significantTermsAggregation(n: number, subsetDocIds: Set<string>): SignificantTermsBucket[] {
    const totalDocs = this.termCounts.size;
    const subsetSize = subsetDocIds.size;
    return [...this.termDocPositions.entries()]
      .map(([term, docPositions]) => {
        const subsetDocCount = countDocsInSubset(docPositions, subsetDocIds);
        if (subsetDocCount === 0) {
          return null;
        }
        const backgroundDocCount = docPositions.size;
        const subsetFrequency = subsetSize === 0 ? 0 : subsetDocCount / subsetSize;
        const backgroundFrequency = backgroundDocCount / (totalDocs || 1);
        const score = backgroundFrequency > 0 ? subsetFrequency / backgroundFrequency : subsetFrequency;
        return {
          key: term,
          score,
          subsetDocCount,
          backgroundDocCount
        } satisfies SignificantTermsBucket;
      })
      .filter((entry): entry is SignificantTermsBucket => entry !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
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

/** GeoJSON field index backed by geohashes for point and polygon querying. */
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

/** Structured numeric field index with range filters and numeric aggregations. */
export class NumericFieldIndex implements FieldIndex {
  private readonly documents: Record<string, number[]>;

  constructor(documents: Record<string, number[]> = {}) {
    this.documents = documents;
  }

  get indexState(): NumericFieldIndexState {
    return {
      kind: "NumericFieldIndexState",
      documents: Object.fromEntries(Object.entries(this.documents).map(([id, values]) => [id, [...values]]))
    };
  }

  loadState(fieldIndexState: IndexState): FieldIndex {
    if (fieldIndexState.kind !== "NumericFieldIndexState") {
      throw new Error(`wrong index type; expecting NumericFieldIndexState but was ${fieldIndexState.kind}`);
    }
    return new NumericFieldIndex(
      Object.fromEntries(Object.entries(fieldIndexState.documents).map(([id, values]) => [id, [...values]]))
    );
  }

  indexValue(docId: string, value: string): void {
    const parsed = parseNumericValue(value);
    if (parsed == null) {
      return;
    }
    this.documents[docId] = [...(this.documents[docId] ?? []), parsed];
  }

  numericValues(docId: string): number[] {
    return [...(this.documents[docId] ?? [])];
  }

  filterRange(params: { lt?: string; lte?: string; gt?: string; gte?: string }): Hits {
    return filterNumericRange(this.documents, params);
  }

  valueCount(subsetDocIds?: Set<string>): number {
    return valuesForSubset(this.documents, subsetDocIds).length;
  }

  min(subsetDocIds?: Set<string>): number | null {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).min;
  }

  max(subsetDocIds?: Set<string>): number | null {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).max;
  }

  sum(subsetDocIds?: Set<string>): number {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).sum;
  }

  avg(subsetDocIds?: Set<string>): number | null {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).avg;
  }

  stats(subsetDocIds?: Set<string>): NumericStatsAggregation {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds));
  }

  rangeAggregation(ranges: NumericRangeAggregationRange[], subsetDocIds?: Set<string>): NumericRangeAggregationBucket[] {
    return createRangeBuckets(this.documents, ranges, subsetDocIds);
  }

  histogram(interval: number, subsetDocIds?: Set<string>): NumericHistogramBucket[] {
    return createHistogramBuckets(this.documents, interval, subsetDocIds);
  }
}

/** Structured date field index with range filters and date histograms. */
export class DateFieldIndex implements FieldIndex {
  private readonly documents: Record<string, number[]>;

  constructor(documents: Record<string, number[]> = {}) {
    this.documents = documents;
  }

  get indexState(): DateFieldIndexState {
    return {
      kind: "DateFieldIndexState",
      documents: Object.fromEntries(Object.entries(this.documents).map(([id, values]) => [id, [...values]]))
    };
  }

  loadState(fieldIndexState: IndexState): FieldIndex {
    if (fieldIndexState.kind !== "DateFieldIndexState") {
      throw new Error(`wrong index type; expecting DateFieldIndexState but was ${fieldIndexState.kind}`);
    }
    return new DateFieldIndex(
      Object.fromEntries(Object.entries(fieldIndexState.documents).map(([id, values]) => [id, [...values]]))
    );
  }

  indexValue(docId: string, value: string): void {
    const parsed = parseNumericValue(value);
    if (parsed == null) {
      return;
    }
    this.documents[docId] = [...(this.documents[docId] ?? []), parsed];
  }

  numericValues(docId: string): number[] {
    return [...(this.documents[docId] ?? [])];
  }

  filterRange(params: { lt?: string; lte?: string; gt?: string; gte?: string }): Hits {
    return filterNumericRange(this.documents, params);
  }

  valueCount(subsetDocIds?: Set<string>): number {
    return valuesForSubset(this.documents, subsetDocIds).length;
  }

  min(subsetDocIds?: Set<string>): number | null {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).min;
  }

  max(subsetDocIds?: Set<string>): number | null {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).max;
  }

  sum(subsetDocIds?: Set<string>): number {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).sum;
  }

  avg(subsetDocIds?: Set<string>): number | null {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds)).avg;
  }

  stats(subsetDocIds?: Set<string>): NumericStatsAggregation {
    return computeNumericStats(valuesForSubset(this.documents, subsetDocIds));
  }

  rangeAggregation(ranges: NumericRangeAggregationRange[], subsetDocIds?: Set<string>): NumericRangeAggregationBucket[] {
    return createRangeBuckets(this.documents, ranges, subsetDocIds);
  }

  dateHistogram(intervalMs: number, subsetDocIds?: Set<string>): DateHistogramBucket[] {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error("date histogram interval should be a finite number > 0");
    }
    return createDateHistogramBuckets(this.documents, intervalMs, subsetDocIds);
  }
}
