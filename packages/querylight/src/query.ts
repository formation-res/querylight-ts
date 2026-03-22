import { type PolygonCoordinates } from "./geo";
import { DateFieldIndex, DocumentIndex, GeoFieldIndex, NumericFieldIndex, TextFieldIndex } from "./document-index";
import { type Hit, type Hits, QueryContext, andHits, applyBoost, geoFieldHits, ids, normalizedBoost, orHits, textFieldHits } from "./query-support";
import { type Document, type Query } from "./shared";
import { type Vector, VectorFieldIndex } from "./vector";

/** Boolean operator used by text queries that combine multiple analyzed terms. */
export enum OP {
  AND = "AND",
  OR = "OR"
}

/** Tuning knobs for {@link VectorRescoreQuery}. */
export interface VectorRescoreOptions {
  windowSize?: number;
  queryWeight?: number;
  rescoreQueryWeight?: number;
}

/** Saturation-style rank feature scoring configuration. */
export interface RankFeatureSaturationOptions {
  type?: "saturation";
  pivot?: number;
}

/** Logarithmic rank feature scoring configuration. */
export interface RankFeatureLogOptions {
  type: "log";
  scalingFactor?: number;
}

/** Sigmoid rank feature scoring configuration. */
export interface RankFeatureSigmoidOptions {
  type: "sigmoid";
  pivot: number;
  exponent?: number;
}

/** Linear rank feature scoring configuration. */
export interface RankFeatureLinearOptions {
  type: "linear";
  factor?: number;
}

/** Supported rank feature scoring modes. */
export type RankFeatureOptions =
  | RankFeatureSaturationOptions
  | RankFeatureLogOptions
  | RankFeatureSigmoidOptions
  | RankFeatureLinearOptions;

/** Runtime values exposed to {@link ScriptQuery} and {@link ScriptScoreQuery} callbacks. */
export interface ScriptExecutionContext {
  documentIndex: DocumentIndex;
  document: Document;
  score: number;
  values(field: string): string[];
  value(field: string): string | undefined;
  numericValues(field: string): number[];
  numericValue(field: string): number | undefined;
}

/** Predicate callback used by {@link ScriptQuery}. */
export type ScriptFilter = (context: ScriptExecutionContext) => boolean;
/** Scoring callback used by {@link ScriptScoreQuery}. */
export type ScriptScore = (context: ScriptExecutionContext) => number;

/** Parameters for constructing a {@link BoolQuery}. */
export interface BoolQueryParams {
  should?: Query[];
  must?: Query[];
  filter?: Query[];
  mustNot?: Query[];
  boost?: number;
  minimumShouldMatch?: number;
}

/** Parameters for constructing a {@link TermQuery}. */
export interface TermQueryParams {
  field: string;
  text: string;
  boost?: number;
}

/** Parameters for constructing a {@link TermsQuery}. */
export interface TermsQueryParams {
  field: string;
  terms: string[];
  boost?: number;
}

/** Parameters for constructing a {@link WildcardQuery}. */
export interface WildcardQueryParams {
  field: string;
  pattern: string;
  boost?: number;
}

/** Parameters for constructing a {@link RegexpQuery}. */
export interface RegexpQueryParams {
  field: string;
  pattern: string | RegExp;
  boost?: number;
}

/** Parameters for constructing an {@link ExistsQuery}. */
export interface ExistsQueryParams {
  field: string;
  boost?: number;
}

/** Parameters for constructing a {@link RangeQuery}. */
export interface RangeQueryParams {
  field: string;
  range?: {
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
  };
  boost?: number;
}

/** Parameters for constructing a {@link MatchQuery}. */
export interface MatchQueryParams {
  field: string;
  text: string;
  operation?: OP;
  prefixMatch?: boolean;
  boost?: number;
}

/** Parameters for constructing a {@link MultiMatchQuery}. */
export interface MultiMatchQueryParams {
  fields: string[];
  text: string;
  operation?: OP;
  prefixMatch?: boolean;
  boost?: number;
  fieldBoosts?: Record<string, number>;
}

/** Parameters for constructing a {@link DisMaxQuery}. */
export interface DisMaxQueryParams {
  queries: Query[];
  tieBreaker?: number;
  boost?: number;
}

/** Parameters for constructing a {@link MatchPhrase}. */
export interface MatchPhraseParams {
  field: string;
  text: string;
  slop?: number;
  boost?: number;
}

/** Parameters for constructing a {@link PrefixQuery}. */
export interface PrefixQueryParams {
  field: string;
  prefix: string;
  boost?: number;
}

/** Parameters for constructing a {@link MatchAll}. */
export interface MatchAllParams {
  boost?: number;
}

/** Parameters for constructing a {@link BoostingQuery}. */
export interface BoostingQueryParams {
  positive: Query;
  negative: Query;
  negativeBoost: number;
  boost?: number;
}

/** Parameters for constructing a {@link GeoPointQuery}. */
export interface GeoPointQueryParams {
  field: string;
  latitude: number;
  longitude: number;
  boost?: number;
}

/** Parameters for constructing a {@link GeoPolygonQuery}. */
export interface GeoPolygonQueryParams {
  field: string;
  polygon: PolygonCoordinates;
  boost?: number;
}

/** Parameters for constructing a {@link DistanceFeatureQuery}. */
export interface DistanceFeatureQueryParams {
  field: string;
  origin: number | string | Date;
  pivot: number;
  boost?: number;
}

/** Parameters for constructing a {@link RankFeatureQuery}. */
export interface RankFeatureQueryParams {
  field: string;
  options?: RankFeatureOptions;
  boost?: number;
}

/** Parameters for constructing a {@link ScriptQuery}. */
export interface ScriptQueryParams {
  script: ScriptFilter;
  boost?: number;
}

/** Parameters for constructing a {@link ScriptScoreQuery}. */
export interface ScriptScoreQueryParams {
  query: Query;
  script: ScriptScore;
  boost?: number;
}

/** Parameters for constructing a {@link VectorRescoreQuery}. */
export interface VectorRescoreQueryParams {
  field: string;
  vector: Vector;
  query: Query;
  options?: VectorRescoreOptions;
  boost?: number;
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

function documentValues(document: Document, field: string): string[] {
  return document.fields[field] ?? [];
}

function numericDocumentValues(document: Document, field: string): number[] {
  return documentValues(document, field)
    .map((value) => parseNumericValue(value))
    .filter((value): value is number => value != null);
}

function indexedNumericValues(documentIndex: DocumentIndex, document: Document, field: string): number[] {
  const fieldIndex = documentIndex.getFieldIndex(field);
  if (fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex) {
    return fieldIndex.numericValues(document.id);
  }
  return numericDocumentValues(document, field);
}

function createScriptExecutionContext(
  documentIndex: DocumentIndex,
  document: Document,
  score: number
): ScriptExecutionContext {
  return {
    documentIndex,
    document,
    score,
    values: (field) => [...documentValues(document, field)],
    value: (field) => documentValues(document, field)[0],
    numericValues: (field) => indexedNumericValues(documentIndex, document, field),
    numericValue: (field) => indexedNumericValues(documentIndex, document, field)[0]
  };
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const source = `^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`;
  return new RegExp(source);
}

function assertRequiredString(value: string | undefined, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} should be a string`);
  }
  return value;
}

function assertRequiredQuery(value: Query | undefined, name: string): Query {
  if (value == null) {
    throw new Error(`${name} should be specified`);
  }
  return value;
}

function assertRequiredQueries(value: Query[] | undefined, name: string): Query[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} should be an array`);
  }
  return value;
}

/** Boolean composition query with Elasticsearch-style should/must/filter/mustNot semantics. */
export class BoolQuery implements Query {
  private readonly should: Query[];
  private readonly must: Query[];
  private readonly filter: Query[];
  private readonly mustNot: Query[];
  public readonly boost: number | undefined;
  private readonly minimumShouldMatch: number;

  constructor(
    {
      should = [],
      must = [],
      filter = [],
      mustNot = [],
      boost,
      minimumShouldMatch = 0
    }: BoolQueryParams = {}
  ) {
    this.should = should;
    this.must = must;
    this.filter = filter;
    this.mustNot = mustNot;
    this.boost = boost;
    this.minimumShouldMatch = minimumShouldMatch;
  }

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
    const shouldMatchCounts = new Map<string, number>();
    for (const hits of mappedShoulds) {
      for (const [id] of hits) {
        shouldMatchCounts.set(id, (shouldMatchCounts.get(id) ?? 0) + 1);
      }
    }

    const baseHits = this.must.length === 0 && this.filter.length === 0 ? [] : mustHits;
    const requiredShouldMatches = this.minimumShouldMatch > 0
      ? this.minimumShouldMatch
      : this.must.length === 0 && this.filter.length === 0 && this.should.length > 0
        ? 1
        : 0;

    let result: Hits;
    if (baseHits.length === 0) {
      result = shouldHits;
    } else if (shouldHits.length === 0) {
      result = requiredShouldMatches > 0 ? [] : baseHits;
    } else {
      const shouldMap = new Map(shouldHits);
      result = baseHits
        .map(([id, score]): Hit | null => {
          const shouldScore = shouldMap.get(id) ?? 0;
          const shouldMatches = shouldMatchCounts.get(id) ?? 0;
          if (requiredShouldMatches > 0 && shouldMatches < requiredShouldMatches) {
            return null;
          }
          return [id, score + shouldScore];
        })
        .filter((hit): hit is Hit => hit !== null)
        .sort((a, b) => b[1] - a[1]);
    }

    if (baseHits.length === 0 && requiredShouldMatches > 1) {
      result = result.filter(([id]) => (shouldMatchCounts.get(id) ?? 0) >= requiredShouldMatches);
    }

    return applyBoost(result, normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return [
      ...this.should.flatMap((query) => query.highlightClauses?.(documentIndex) ?? []),
      ...this.must.flatMap((query) => query.highlightClauses?.(documentIndex) ?? [])
    ];
  }
}

/** Exact term-level query against a single text field. */
export class TermQuery implements Query {
  private readonly field: string;
  private readonly text: string;
  public readonly boost: number | undefined;

  constructor({ field, text, boost }: TermQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.text = assertRequiredString(text, "text");
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => [...new Set((fieldIndex.termMatches(this.text) ?? []).map((match) => match.id))].map((id): Hit => [id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Any-of exact term query against a single text field. */
export class TermsQuery implements Query {
  private readonly field: string;
  private readonly terms: string[];
  public readonly boost: number | undefined;

  constructor({ field, terms, boost }: TermsQueryParams) {
    this.field = assertRequiredString(field, "field");
    if (!Array.isArray(terms)) {
      throw new Error("terms should be an array");
    }
    this.terms = terms;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => {
      const termHits = [...new Set(this.terms)]
        .map((term) => (fieldIndex.termMatches(term) ?? []).map((match): Hit => [match.id, 1.0]));
      return termHits.length > 0 ? termHits.reduce(orHits, []) : [];
    });
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses() {
    return this.terms.map((term) => ({
      kind: "term" as const,
      field: this.field,
      text: term,
      operation: OP.OR,
      prefixMatch: false
    }));
  }
}

/** Wildcard pattern query over indexed terms. */
export class WildcardQuery implements Query {
  private readonly matcher: RegExp;
  private readonly field: string;
  private readonly pattern: string;
  public readonly boost: number | undefined;

  constructor({ field, pattern, boost }: WildcardQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.pattern = assertRequiredString(pattern, "pattern");
    this.boost = boost;
    this.matcher = wildcardToRegExp(pattern);
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => {
      const termHits = fieldIndex.terms()
        .filter((term) => this.matcher.test(term))
        .map((term) => (fieldIndex.termMatches(term) ?? []).map((match): Hit => [match.id, 1.0]));
      return termHits.length > 0 ? termHits.reduce(orHits, []) : [];
    });
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Regular-expression query over indexed terms. */
export class RegexpQuery implements Query {
  private readonly matcher: RegExp;
  private readonly field: string;
  public readonly boost: number | undefined;

  constructor({ field, pattern, boost }: RegexpQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.boost = boost;
    this.matcher = typeof pattern === "string"
      ? new RegExp(pattern)
      : new RegExp(pattern.source, pattern.flags.replaceAll("g", ""));
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => {
      const termHits = fieldIndex.terms()
        .filter((term) => this.matcher.test(term))
        .map((term) => (fieldIndex.termMatches(term) ?? []).map((match): Hit => [match.id, 1.0]));
      return termHits.length > 0 ? termHits.reduce(orHits, []) : [];
    });
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Filter that matches documents where a field has at least one stored value. */
export class ExistsQuery implements Query {
  private readonly field: string;
  public readonly boost: number | undefined;

  constructor({ field, boost }: ExistsQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = Object.values(documentIndex.documents)
      .filter((document) => (document.fields[this.field] ?? []).length > 0)
      .map((document): Hit => [document.id, 1.0]);
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Range query for lexical, numeric, or date fields. */
export class RangeQuery implements Query {
  private readonly field: string;
  private readonly params: {
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
  };
  public readonly boost: number | undefined;

  constructor({ field, range = {}, boost }: RangeQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.params = range;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndex = documentIndex.getFieldIndex(this.field);
    const hits = fieldIndex instanceof TextFieldIndex
      ? fieldIndex.filterTermsByRange(this.params)
      : fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex
        ? fieldIndex.filterRange(this.params)
        : [];
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Full-text query against one field using analyzed terms and optional prefix expansion. */
export class MatchQuery implements Query {
  private readonly field: string;
  private readonly text: string;
  private readonly operation: OP;
  private readonly prefixMatch: boolean;
  public readonly boost: number | undefined;

  constructor({ field, text, operation = OP.AND, prefixMatch = false, boost }: MatchQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.text = assertRequiredString(text, "text");
    this.operation = operation;
    this.prefixMatch = prefixMatch;
    this.boost = boost;
  }

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

  highlightClauses() {
    return [{
      kind: "term" as const,
      field: this.field,
      text: this.text,
      operation: this.operation,
      prefixMatch: this.prefixMatch
    }];
  }
}

/** Full-text query that allows analyzed terms to match across multiple fields. */
export class MultiMatchQuery implements Query {
  private readonly fields: string[];
  private readonly text: string;
  private readonly operation: OP;
  private readonly prefixMatch: boolean;
  public readonly boost: number | undefined;
  private readonly fieldBoosts: Record<string, number>;

  constructor(
    {
      fields,
      text,
      operation = OP.AND,
      prefixMatch = false,
      boost,
      fieldBoosts = {}
    }: MultiMatchQueryParams
  ) {
    if (!Array.isArray(fields)) {
      throw new Error("fields should be an array");
    }
    this.fields = fields;
    this.text = assertRequiredString(text, "text");
    this.operation = operation;
    this.prefixMatch = prefixMatch;
    this.boost = boost;
    this.fieldBoosts = fieldBoosts;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const fieldIndexes = this.fields
      .map((field) => {
        const fieldIndex = documentIndex.getFieldIndex(field);
        return fieldIndex instanceof TextFieldIndex ? [field, fieldIndex] as const : null;
      })
      .filter((entry): entry is readonly [string, TextFieldIndex] => entry !== null);
    if (fieldIndexes.length === 0) {
      return [];
    }

    const searchTerms = fieldIndexes[0]![1].queryAnalyzer.analyze(this.text);
    if (searchTerms.length === 0) {
      return [];
    }

    const termHits = searchTerms.map((term) => fieldIndexes
      .map(([field, fieldIndex]) => applyBoost(fieldIndex.searchTerm(term, this.prefixMatch), this.fieldBoosts[field] ?? 1.0))
      .reduce(orHits, []));
    const hits = this.operation === OP.AND ? termHits.reduce(andHits) : termHits.reduce(orHits);
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return this.fields.flatMap((field) => (
      new MatchQuery({
        field,
        text: this.text,
        operation: this.operation,
        prefixMatch: this.prefixMatch,
        boost: this.fieldBoosts[field] ?? 1.0
      }).highlightClauses()
    ));
  }
}

/** Best-field query that keeps the strongest clause dominant with an optional tie breaker. */
export class DisMaxQuery implements Query {
  private readonly tieBreaker: number;
  private readonly queries: Query[];
  public readonly boost: number | undefined;

  constructor({ queries, tieBreaker = 0, boost }: DisMaxQueryParams) {
    this.queries = assertRequiredQueries(queries, "queries");
    if (!Number.isFinite(tieBreaker) || tieBreaker < 0 || tieBreaker > 1) {
      throw new Error("tieBreaker should be a finite number between 0 and 1");
    }
    this.tieBreaker = tieBreaker;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex, context: QueryContext = new QueryContext()): Hits {
    if (this.queries.length === 0) {
      return [];
    }

    const perDocScores = new Map<string, number[]>();
    for (const query of this.queries) {
      for (const [id, score] of query.hits(documentIndex, context)) {
        const scores = perDocScores.get(id) ?? [];
        scores.push(score);
        perDocScores.set(id, scores);
      }
    }

    const hits = [...perDocScores.entries()]
      .map(([id, scores]): Hit => {
        const maxScore = Math.max(...scores);
        const sum = scores.reduce((total, score) => total + score, 0);
        return [id, maxScore + (sum - maxScore) * this.tieBreaker];
      })
      .sort((a, b) => b[1] - a[1]);

    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return this.queries.flatMap((query) => query.highlightClauses?.(documentIndex) ?? []);
  }
}

/** Phrase query with optional slop. */
export class MatchPhrase implements Query {
  private readonly field: string;
  private readonly text: string;
  private readonly slop: number;
  public readonly boost: number | undefined;

  constructor({ field, text, slop = 0, boost }: MatchPhraseParams) {
    this.field = assertRequiredString(field, "field");
    this.text = assertRequiredString(text, "text");
    this.slop = slop;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => {
      const searchTerms = fieldIndex.queryAnalyzer.analyze(this.text);
      return fieldIndex.searchPhrase(searchTerms, this.slop);
    });
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses() {
    return [{
      kind: "phrase" as const,
      field: this.field,
      text: this.text,
      slop: this.slop
    }];
  }
}

/** Prefix lookup query over trie-backed text fields. */
export class PrefixQuery implements Query {
  private readonly field: string;
  private readonly prefix: string;
  public readonly boost: number | undefined;

  constructor({ field, prefix, boost }: PrefixQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.prefix = assertRequiredString(prefix, "prefix");
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => fieldIndex.searchPrefix(this.prefix));
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses() {
    return [{
      kind: "term" as const,
      field: this.field,
      text: this.prefix,
      operation: OP.OR,
      prefixMatch: true
    }];
  }
}

/** Query that matches every indexed document. */
export class MatchAll implements Query {
  public readonly boost: number | undefined;

  constructor({ boost }: MatchAllParams = {}) {
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    return applyBoost([...documentIndex.ids()].map((id): Hit => [id, 1.0]), normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Query wrapper that softly demotes hits matching a negative clause. */
export class BoostingQuery implements Query {
  private readonly negativeBoost: number;
  private readonly positive: Query;
  private readonly negative: Query;
  public readonly boost: number | undefined;

  constructor({ positive, negative, negativeBoost, boost }: BoostingQueryParams) {
    this.positive = assertRequiredQuery(positive, "positive");
    this.negative = assertRequiredQuery(negative, "negative");
    if (!Number.isFinite(negativeBoost) || negativeBoost <= 0 || negativeBoost > 1) {
      throw new Error("negativeBoost should be a finite number > 0 and <= 1");
    }
    this.negativeBoost = negativeBoost;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex, context: QueryContext = new QueryContext()): Hits {
    const positiveHits = this.positive.hits(documentIndex, context);
    const negativeIds = new Set(ids(this.negative.hits(documentIndex, context)));
    const hits = positiveHits
      .map(([id, score]): Hit => [id, negativeIds.has(id) ? score * this.negativeBoost : score])
      .filter(([, score]) => score > 0);
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return this.positive.highlightClauses?.(documentIndex) ?? [];
  }
}

/** Geo query that matches documents containing a point. */
export class GeoPointQuery implements Query {
  private readonly field: string;
  private readonly latitude: number;
  private readonly longitude: number;
  public readonly boost: number | undefined;

  constructor({ field, latitude, longitude, boost }: GeoPointQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.latitude = latitude;
    this.longitude = longitude;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = geoFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => fieldIndex.queryPoint(this.latitude, this.longitude).map((id): Hit => [id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Geo query that matches documents intersecting a polygon. */
export class GeoPolygonQuery implements Query {
  private readonly field: string;
  private readonly polygon: PolygonCoordinates;
  public readonly boost: number | undefined;

  constructor({ field, polygon, boost }: GeoPolygonQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.polygon = polygon;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = geoFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => fieldIndex.queryPolygon(this.polygon).map((id): Hit => [id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Numeric/date feature query that boosts values closest to an origin. */
export class DistanceFeatureQuery implements Query {
  private readonly origin: number;
  private readonly pivot: number;
  private readonly field: string;
  public readonly boost: number | undefined;

  constructor({ field, origin, pivot, boost }: DistanceFeatureQueryParams) {
    this.field = assertRequiredString(field, "field");
    const parsedOrigin = parseNumericValue(origin);
    if (parsedOrigin == null) {
      throw new Error("origin should be a finite number or parseable date");
    }
    if (!Number.isFinite(pivot) || pivot <= 0) {
      throw new Error("pivot should be a finite number > 0");
    }
    this.origin = parsedOrigin;
    this.pivot = pivot;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = Object.values(documentIndex.documents)
      .map((document): Hit | null => {
        const numericValues = indexedNumericValues(documentIndex, document, this.field);
        if (numericValues.length === 0) {
          return null;
        }
        const closestDistance = Math.min(...numericValues.map((value) => Math.abs(value - this.origin)));
        return [document.id, this.pivot / (this.pivot + closestDistance)];
      })
      .filter((hit): hit is Hit => hit !== null)
      .sort((a, b) => b[1] - a[1]);

    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Numeric feature query for saturation, log, sigmoid, or linear boosting. */
export class RankFeatureQuery implements Query {
  private readonly field: string;
  private readonly options: RankFeatureOptions;
  public readonly boost: number | undefined;

  constructor({ field, options = {}, boost }: RankFeatureQueryParams) {
    this.field = assertRequiredString(field, "field");
    this.options = options;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = Object.values(documentIndex.documents)
      .map((document): Hit | null => {
        const numericValues = indexedNumericValues(documentIndex, document, this.field);
        if (numericValues.length === 0) {
          return null;
        }
        const featureValue = Math.max(...numericValues);
        const score = this.rankFeatureScore(featureValue);
        return score > 0 ? [document.id, score] : null;
      })
      .filter((hit): hit is Hit => hit !== null)
      .sort((a, b) => b[1] - a[1]);

    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }

  private rankFeatureScore(value: number): number {
    switch (this.options.type) {
      case "linear":
        return value * (this.options.factor ?? 1.0);
      case "log":
        return Math.log((this.options.scalingFactor ?? 1.0) + value);
      case "sigmoid": {
        const exponent = this.options.exponent ?? 1;
        const pivot = this.options.pivot;
        if (!Number.isFinite(pivot) || pivot <= 0) {
          throw new Error("sigmoid rank feature pivot should be a finite number > 0");
        }
        if (!Number.isFinite(exponent) || exponent <= 0) {
          throw new Error("sigmoid rank feature exponent should be a finite number > 0");
        }
        return value <= 0 ? 0 : (value ** exponent) / (pivot ** exponent + value ** exponent);
      }
      case "saturation":
      case undefined: {
        const pivot = this.options.pivot ?? 1.0;
        if (!Number.isFinite(pivot) || pivot <= 0) {
          throw new Error("saturation rank feature pivot should be a finite number > 0");
        }
        return value <= 0 ? 0 : value / (value + pivot);
      }
      default:
        return 0;
    }
  }
}

/** Custom JavaScript predicate query. */
export class ScriptQuery implements Query {
  private readonly script: ScriptFilter;
  public readonly boost: number | undefined;

  constructor({ script, boost }: ScriptQueryParams) {
    if (typeof script !== "function") {
      throw new Error("script should be a function");
    }
    this.script = script;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex): Hits {
    const hits = Object.values(documentIndex.documents)
      .filter((document) => this.script(createScriptExecutionContext(documentIndex, document, 1.0)))
      .map((document): Hit => [document.id, 1.0]);
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

/** Query wrapper that replaces the base score with a custom script score. */
export class ScriptScoreQuery implements Query {
  private readonly query: Query;
  private readonly script: ScriptScore;
  public readonly boost: number | undefined;

  constructor({ query, script, boost }: ScriptScoreQueryParams) {
    this.query = assertRequiredQuery(query, "query");
    if (typeof script !== "function") {
      throw new Error("script should be a function");
    }
    this.script = script;
    this.boost = boost;
  }

  hits(documentIndex: DocumentIndex, context: QueryContext = new QueryContext()): Hits {
    const hits = this.query.hits(documentIndex, context)
      .map(([id, score]): Hit | null => {
        const document = documentIndex.get(id);
        if (!document) {
          return null;
        }
        const nextScore = this.script(createScriptExecutionContext(documentIndex, document, score));
        return Number.isFinite(nextScore) && nextScore > 0 ? [id, nextScore] : null;
      })
      .filter((hit): hit is Hit => hit !== null)
      .sort((a, b) => b[1] - a[1]);

    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return this.query.highlightClauses?.(documentIndex) ?? [];
  }
}

/** Hybrid query that reranks the top lexical window with vector similarity. */
export class VectorRescoreQuery implements Query {
  private readonly windowSize: number;
  private readonly queryWeight: number;
  private readonly rescoreQueryWeight: number;
  private readonly field: string;
  private readonly vector: Vector;
  private readonly query: Query;
  public readonly boost: number | undefined;

  constructor(
    {
      field,
      vector,
      query,
      options: {
      windowSize = 50,
      queryWeight = 1.0,
      rescoreQueryWeight = 1.0
      } = {},
      boost
    }: VectorRescoreQueryParams
  ) {
    this.field = assertRequiredString(field, "field");
    this.vector = vector;
    this.query = assertRequiredQuery(query, "query");
    this.boost = boost;
    if (!Number.isInteger(windowSize) || windowSize < 0) {
      throw new Error("windowSize should be an integer >= 0");
    }
    if (!Number.isFinite(queryWeight) || queryWeight < 0) {
      throw new Error("queryWeight should be a finite number >= 0");
    }
    if (!Number.isFinite(rescoreQueryWeight) || rescoreQueryWeight < 0) {
      throw new Error("rescoreQueryWeight should be a finite number >= 0");
    }

    this.windowSize = windowSize;
    this.queryWeight = queryWeight;
    this.rescoreQueryWeight = rescoreQueryWeight;
  }

  hits(documentIndex: DocumentIndex, context: QueryContext = new QueryContext()): Hits {
    const baseHits = this.query.hits(documentIndex, context);
    const vectorIndex = documentIndex.getFieldIndex(this.field);

    if (!(vectorIndex instanceof VectorFieldIndex) || this.windowSize === 0 || baseHits.length === 0) {
      return applyBoost(baseHits.map(([id, score]): Hit => [id, score * this.queryWeight]), normalizedBoost(this));
    }

    const windowHits = baseHits.slice(0, this.windowSize);
    const rescoredHits = vectorIndex.rerank(this.vector, ids(windowHits));
    const rescoredMap = new Map(rescoredHits);

    const rescoredWindow = windowHits
      .map(([id, score], rank) => ({
        id,
        score: score * this.queryWeight + (rescoredMap.get(id) ?? 0) * this.rescoreQueryWeight,
        rank
      }))
      .sort((a, b) => {
        const scoreDelta = b.score - a.score;
        return scoreDelta !== 0 ? scoreDelta : a.rank - b.rank;
      })
      .map(({ id, score }): Hit => [id, score]);

    const tailHits = baseHits
      .slice(this.windowSize)
      .map(([id, score]): Hit => [id, score * this.queryWeight]);

    return applyBoost([...rescoredWindow, ...tailHits], normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return this.query.highlightClauses?.(documentIndex) ?? [];
  }
}
