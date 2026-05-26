import { DateFieldIndex, DocumentIndex, NumericFieldIndex, TextFieldIndex } from "./document-index";
import {
  BoolQuery,
  BoostingQuery,
  DisMaxQuery,
  DistanceFeatureQuery,
  ExistsQuery,
  GeoPointQuery,
  GeoPolygonQuery,
  KnnQuery,
  MatchAll,
  MatchPhrase,
  MatchQuery,
  MultiMatchQuery,
  OP,
  PrefixQuery,
  ReciprocalRankFusionQuery,
  RankFeatureQuery,
  RangeQuery,
  RegexpQuery,
  ScriptQuery,
  ScriptScoreQuery,
  SparseVectorQuery,
  SparseVectorRescoreQuery,
  TermQuery,
  TermsQuery,
  VectorRescoreQuery,
  WildcardQuery,
  type RankFeatureOptions,
  type ScriptExecutionContext
} from "./query";
import { type Document, ids, type NumericRangeAggregationRange, type Query } from "./shared";
import { type PolygonCoordinates } from "./geo";
import { type SparseVector } from "./sparse-vector";
import { type Vector } from "./vector";
import { simpleTextSearch, type SimpleTextSearchIndex, type SimpleTextSearchRequest } from "./simple-text-search";

type JsonRecord = Record<string, unknown>;

/** JavaScript source and optional params used by JSON DSL script clauses. */
export interface JsonDslScript {
  source: string;
  params?: Record<string, unknown> | undefined;
}

/** Per-field highlight overrides for JSON DSL requests. */
export interface JsonDslHighlightField {
  fragment_size?: number | undefined;
  number_of_fragments?: number | undefined;
}

/** Highlight section for JSON DSL requests. */
export interface JsonDslHighlight {
  fields: Record<string, JsonDslHighlightField>;
  fragment_size?: number | undefined;
  number_of_fragments?: number | undefined;
  require_field_match?: boolean | undefined;
}

/** Aggregation clause accepted by the JSON DSL. */
export type JsonDslAggregationClause = Record<string, unknown>;

/** Query clause accepted by the JSON DSL. */
export type JsonDslQueryClause = Record<string, unknown>;

/** OpenSearch-style JSON search request accepted by {@link searchJsonDsl}. */
export interface JsonDslRequest {
  query?: JsonDslQueryClause | undefined;
  knn?: Record<string, unknown> | undefined;
  sparse_vector?: Record<string, unknown> | undefined;
  neural_sparse?: Record<string, unknown> | undefined;
  simple_text_search?: JsonDslSimpleTextSearchRequest | undefined;
  from?: number | undefined;
  size?: number | undefined;
  aggs?: Record<string, JsonDslAggregationClause> | undefined;
  aggregations?: Record<string, JsonDslAggregationClause> | undefined;
  highlight?: JsonDslHighlight | undefined;
}

/** One hit returned by {@link searchJsonDsl}. */
export interface JsonDslSearchHit {
  _index: string;
  _id: string;
  _score: number;
  _source: Record<string, unknown>;
  highlight?: Record<string, string[]> | undefined;
}

/** Elasticsearch-style hit container returned by {@link searchJsonDsl}. */
export interface JsonDslHits {
  total: {
    value: number;
    relation: "eq";
  };
  max_score: number | null;
  hits: JsonDslSearchHit[];
}

/** JSON DSL aggregation response payload. */
export type JsonDslAggregationResult = Record<string, unknown>;

/** Full JSON DSL response returned by {@link searchJsonDsl}. */
export interface JsonDslResponse {
  took: number;
  hits: JsonDslHits;
  aggregations?: Record<string, JsonDslAggregationResult> | undefined;
}

/** Params object for {@link parseJsonDslQuery}. */
export interface ParseJsonDslQueryParams {
  query: JsonDslQueryClause;
}

/** Params object for {@link searchJsonDsl}. */
export interface SearchJsonDslParams {
  index: DocumentIndex | SimpleTextSearchIndex;
  request: JsonDslRequest;
  indexName?: string | undefined;
}

/** Request payload for driving the built-in simpleTextSearch flow through the JSON DSL. */
export interface JsonDslSimpleTextSearchRequest extends SimpleTextSearchRequest {}

function assertRecord(value: unknown, name: string): JsonRecord {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} should be an object`);
  }
  return value as JsonRecord;
}

function assertArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} should be an array`);
  }
  return value;
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} should be a string`);
  }
  return value;
}

function assertNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} should be a finite number`);
  }
  return value;
}

function assertInteger(value: unknown, name: string): number {
  const asNumber = assertNumber(value, name);
  if (!Number.isInteger(asNumber)) {
    throw new Error(`${name} should be an integer`);
  }
  return asNumber;
}

function asOptionalNumber(value: unknown, name: string): number | undefined {
  return value == null ? undefined : assertNumber(value, name);
}

function asOptionalString(value: unknown, name: string): string | undefined {
  return value == null ? undefined : assertString(value, name);
}

function definedProps<T extends JsonRecord>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function parseOperator(value: unknown): OP | undefined {
  if (value == null) {
    return undefined;
  }
  const normalized = assertString(value, "operator").toUpperCase();
  if (normalized === "AND") {
    return OP.AND;
  }
  if (normalized === "OR") {
    return OP.OR;
  }
  throw new Error("operator should be 'and' or 'or'");
}

function normalizeArrayOfQueries(value: unknown, name: string): Query[] {
  const clauses = Array.isArray(value) ? value : [value];
  return clauses.map((entry, index) => parseJsonDslQuery({ query: assertRecord(entry, `${name}[${index}]`) }));
}

function singleFieldEntry(body: JsonRecord, clauseName: string): [string, unknown] {
  const entries = Object.entries(body);
  if (entries.length !== 1) {
    throw new Error(`${clauseName} should contain exactly one field entry`);
  }
  return entries[0]!;
}

function parseFieldBoosts(fields: string[], explicitBoosts: Record<string, number> = {}): { fields: string[]; fieldBoosts: Record<string, number> } {
  const fieldBoosts: Record<string, number> = { ...explicitBoosts };
  const normalizedFields = fields.map((field) => {
    const [name, boostValue] = field.split("^");
    if (boostValue != null && boostValue.length > 0) {
      fieldBoosts[name!] = Number(boostValue);
    }
    return name!;
  });
  return { fields: normalizedFields, fieldBoosts };
}

function parseGeoPoint(value: unknown): { latitude: number; longitude: number } {
  if (Array.isArray(value) && value.length >= 2) {
    return {
      longitude: assertNumber(value[0], "longitude"),
      latitude: assertNumber(value[1], "latitude")
    };
  }

  const body = assertRecord(value, "point");
  return {
    latitude: assertNumber(body.lat, "lat"),
    longitude: assertNumber(body.lon, "lon")
  };
}

function parsePolygonCoordinates(value: unknown): PolygonCoordinates {
  const coordinates = assertArray(value, "polygon coordinates");
  const ring = Array.isArray(coordinates[0]) && Array.isArray((coordinates[0] as unknown[])[0])
    ? assertArray(coordinates[0], "polygon coordinates[0]")
    : coordinates;
  return [ring.map((position, index) => {
    const pair = assertArray(position, `polygon coordinates[${index}]`);
    if (pair.length < 2) {
      throw new Error("polygon positions should contain [lon, lat]");
    }
    return [
      assertNumber(pair[0], `polygon coordinates[${index}][0]`),
      assertNumber(pair[1], `polygon coordinates[${index}][1]`)
    ] as [number, number];
  })] as unknown as PolygonCoordinates;
}

function compileScript(sourceOrScript: unknown, name: string): JsonDslScript {
  if (typeof sourceOrScript === "string") {
    return { source: sourceOrScript };
  }
  const script = assertRecord(sourceOrScript, name);
  return definedProps({
    source: assertString(script.source, `${name}.source`),
    params: script.params == null ? undefined : assertRecord(script.params, `${name}.params`)
  });
}

function createFilterScript(definition: JsonDslScript) {
  const runner = new Function(
    "context",
    "params",
    "const { documentIndex, document, score, values, value, numericValues, numericValue } = context; return (" + definition.source + ");"
  ) as (context: ScriptExecutionContext, params: Record<string, unknown>) => unknown;
  return (context: ScriptExecutionContext) => Boolean(runner(context, definition.params ?? {}));
}

function createScoreScript(definition: JsonDslScript) {
  const runner = new Function(
    "context",
    "params",
    "const { documentIndex, document, score, values, value, numericValues, numericValue } = context; return (" + definition.source + ");"
  ) as (context: ScriptExecutionContext, params: Record<string, unknown>) => unknown;
  return (context: ScriptExecutionContext) => Number(runner(context, definition.params ?? {}));
}

function parseDenseVectorClause(value: unknown): { field: string; vector: Vector; k: number; boost?: number } {
  const body = assertRecord(value, "knn");
  if (body.field != null) {
    return definedProps({
      field: assertString(body.field, "knn.field"),
      vector: assertArray(body.vector, "knn.vector").map((entry, index) => assertNumber(entry, `knn.vector[${index}]`)),
      k: assertInteger(body.k, "knn.k"),
      boost: asOptionalNumber(body.boost, "knn.boost")
    }) as any;
  }

  const [field, rawConfig] = singleFieldEntry(body, "knn");
  const config = assertRecord(rawConfig, `knn.${field}`);
  return definedProps({
    field,
    vector: assertArray(config.vector, `knn.${field}.vector`).map((entry, index) => assertNumber(entry, `knn.${field}.vector[${index}]`)),
    k: assertInteger(config.k, `knn.${field}.k`),
    boost: asOptionalNumber(config.boost, `knn.${field}.boost`)
  }) as any;
}

function parseSparseVectorClause(value: unknown, clauseName: string): { field: string; vector: SparseVector; k: number; boost?: number } {
  const body = assertRecord(value, clauseName);
  if (body.field != null) {
    return definedProps({
      field: assertString(body.field, `${clauseName}.field`),
      vector: assertRecord(body.vector, `${clauseName}.vector`) as SparseVector,
      k: assertInteger(body.k, `${clauseName}.k`),
      boost: asOptionalNumber(body.boost, `${clauseName}.boost`)
    }) as any;
  }

  const [field, rawConfig] = singleFieldEntry(body, clauseName);
  const config = assertRecord(rawConfig, `${clauseName}.${field}`);
  return definedProps({
    field,
    vector: assertRecord(config.vector, `${clauseName}.${field}.vector`) as SparseVector,
    k: assertInteger(config.k, `${clauseName}.${field}.k`),
    boost: asOptionalNumber(config.boost, `${clauseName}.${field}.boost`)
  }) as any;
}

function parseRangeBounds(value: unknown, name: string) {
  const body = assertRecord(value, name);
  return {
    gt: asOptionalString(body.gt, `${name}.gt`),
    gte: asOptionalString(body.gte, `${name}.gte`),
    lt: asOptionalString(body.lt, `${name}.lt`),
    lte: asOptionalString(body.lte, `${name}.lte`),
    boost: asOptionalNumber(body.boost, `${name}.boost`)
  };
}

function parseRankFeatureOptions(body: JsonRecord): RankFeatureOptions | undefined {
  if (body.log != null) {
    const log = assertRecord(body.log, "rank_feature.log");
    return definedProps({ type: "log" as const, scalingFactor: asOptionalNumber(log.scaling_factor, "rank_feature.log.scaling_factor") }) as any;
  }
  if (body.sigmoid != null) {
    const sigmoid = assertRecord(body.sigmoid, "rank_feature.sigmoid");
    return definedProps({
      type: "sigmoid" as const,
      pivot: assertNumber(sigmoid.pivot, "rank_feature.sigmoid.pivot"),
      exponent: asOptionalNumber(sigmoid.exponent, "rank_feature.sigmoid.exponent")
    }) as any;
  }
  if (body.linear != null) {
    const linear = assertRecord(body.linear, "rank_feature.linear");
    return definedProps({ type: "linear" as const, factor: asOptionalNumber(linear.factor, "rank_feature.linear.factor") }) as any;
  }
  if (body.saturation != null) {
    const saturation = assertRecord(body.saturation, "rank_feature.saturation");
    return definedProps({ type: "saturation" as const, pivot: asOptionalNumber(saturation.pivot, "rank_feature.saturation.pivot") }) as any;
  }
  return undefined;
}

function parseIntervalMs(value: unknown, name: string): number {
  if (typeof value === "number") {
    return assertNumber(value, name);
  }
  const text = assertString(value, name).trim();
  const match = text.match(/^(\d+)(ms|s|m|h|d|w)$/);
  if (!match) {
    throw new Error(`${name} should be a number of milliseconds or a fixed interval like 1d`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "ms"
    ? 1
    : unit === "s"
      ? 1000
      : unit === "m"
        ? 60 * 1000
        : unit === "h"
          ? 60 * 60 * 1000
          : unit === "d"
            ? 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;
  return amount * multiplier;
}

function formatHighlight(index: DocumentIndex, id: string, query: Query | undefined, highlight: JsonDslHighlight | undefined) {
  if (!query || !highlight) {
    return undefined;
  }

  const fields = Object.entries(highlight.fields);
  const result: Record<string, string[]> = {};
  for (const [field, overrides] of fields) {
    const fragments = index.highlight(id, query, definedProps({
      fields: [field],
      fragmentSize: overrides.fragment_size ?? highlight.fragment_size,
      numberOfFragments: overrides.number_of_fragments ?? highlight.number_of_fragments,
      requireFieldMatch: highlight.require_field_match
    }) as any);
    const texts = fragments.fields.flatMap((entry) => entry.fragments.map((fragment) => fragment.text));
    if (texts.length > 0) {
      result[field] = texts;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function aggregationSubset(hits: Array<[string, number]>): Set<string> {
  return new Set(ids(hits));
}

function isSimpleTextSearchIndex(index: DocumentIndex | SimpleTextSearchIndex): index is SimpleTextSearchIndex {
  return "documentIndex" in index && "fuzzyIndex" in index;
}

function rootDocumentIndex(index: DocumentIndex | SimpleTextSearchIndex): DocumentIndex {
  return isSimpleTextSearchIndex(index) ? index.documentIndex : index;
}

function sourceForHit(index: DocumentIndex | SimpleTextSearchIndex, id: string): Record<string, unknown> | undefined {
  if (isSimpleTextSearchIndex(index)) {
    return index.documentsById.get(id) ?? index.documentIndex.get(id)?.fields;
  }
  return index.getSource(id) ?? index.get(id)?.source ?? index.get(id)?.fields;
}

function computeAggregation(index: DocumentIndex, subsetDocIds: Set<string>, clause: JsonDslAggregationClause): JsonDslAggregationResult {
  const body = assertRecord(clause, "aggregation");
  const [kind, rawConfig] = singleFieldEntry(body, "aggregation");
  const config = assertRecord(rawConfig, `aggregation.${kind}`);
  const field = kind === "value_count" || kind === "min" || kind === "max" || kind === "sum" || kind === "avg" || kind === "stats" ||
    kind === "range" || kind === "histogram" || kind === "date_histogram" || kind === "terms" || kind === "significant_terms"
    ? assertString(config.field, `aggregation.${kind}.field`)
    : undefined;
  const fieldIndex = field ? index.getFieldIndex(field) : undefined;

  switch (kind) {
    case "terms": {
      if (!(fieldIndex instanceof TextFieldIndex)) {
        throw new Error(`terms aggregation requires a TextFieldIndex for field ${field}`);
      }
      const buckets = Object.entries(fieldIndex.termsAggregation(assertInteger(config.size ?? 10, "aggregation.terms.size"), subsetDocIds))
        .map(([key, docCount]) => ({ key, doc_count: docCount }));
      return { buckets };
    }
    case "significant_terms": {
      if (!(fieldIndex instanceof TextFieldIndex)) {
        throw new Error(`significant_terms aggregation requires a TextFieldIndex for field ${field}`);
      }
      const buckets = fieldIndex.significantTermsAggregation(assertInteger(config.size ?? 10, "aggregation.significant_terms.size"), subsetDocIds)
        .map((bucket) => ({
          key: bucket.key,
          score: bucket.score,
          doc_count: bucket.subsetDocCount,
          bg_count: bucket.backgroundDocCount
        }));
      return {
        doc_count: subsetDocIds.size,
        bg_count: index.ids().size,
        buckets
      };
    }
    case "value_count": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`value_count aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      return { value: fieldIndex.valueCount(subsetDocIds) };
    }
    case "min": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`min aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      return { value: fieldIndex.min(subsetDocIds) };
    }
    case "max": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`max aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      return { value: fieldIndex.max(subsetDocIds) };
    }
    case "sum": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`sum aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      return { value: fieldIndex.sum(subsetDocIds) };
    }
    case "avg": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`avg aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      return { value: fieldIndex.avg(subsetDocIds) };
    }
    case "stats": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`stats aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      return fieldIndex.stats(subsetDocIds) as unknown as JsonDslAggregationResult;
    }
    case "range": {
      if (!(fieldIndex instanceof NumericFieldIndex || fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`range aggregation requires a NumericFieldIndex or DateFieldIndex for field ${field}`);
      }
      const ranges = assertArray(config.ranges, "aggregation.range.ranges") as NumericRangeAggregationRange[];
      return {
        buckets: fieldIndex.rangeAggregation(ranges, subsetDocIds).map((bucket) => ({
          key: bucket.key,
          from: bucket.from,
          to: bucket.to,
          doc_count: bucket.docCount
        }))
      };
    }
    case "histogram": {
      if (!(fieldIndex instanceof NumericFieldIndex)) {
        throw new Error(`histogram aggregation requires a NumericFieldIndex for field ${field}`);
      }
      return {
        buckets: fieldIndex.histogram(assertNumber(config.interval, "aggregation.histogram.interval"), subsetDocIds).map((bucket) => ({
          key: bucket.key,
          doc_count: bucket.docCount
        }))
      };
    }
    case "date_histogram": {
      if (!(fieldIndex instanceof DateFieldIndex)) {
        throw new Error(`date_histogram aggregation requires a DateFieldIndex for field ${field}`);
      }
      const intervalMs = parseIntervalMs(config.fixed_interval ?? config.interval, "aggregation.date_histogram.fixed_interval");
      return {
        buckets: fieldIndex.dateHistogram(intervalMs, subsetDocIds).map((bucket) => ({
          key: bucket.key,
          key_as_string: bucket.keyAsString,
          doc_count: bucket.docCount
        }))
      };
    }
    default:
      throw new Error(`unsupported aggregation type: ${kind}`);
  }
}

function parseTopLevelQuery(request: JsonDslRequest): Query | undefined {
  const clauses: Query[] = [];
  if (request.query) {
    clauses.push(parseJsonDslQuery({ query: request.query }));
  }
  if (request.knn) {
    clauses.push(parseJsonDslQuery({ query: { knn: request.knn } }));
  }
  if (request.sparse_vector) {
    clauses.push(parseJsonDslQuery({ query: { sparse_vector: request.sparse_vector } }));
  }
  if (request.neural_sparse) {
    clauses.push(parseJsonDslQuery({ query: { neural_sparse: request.neural_sparse } }));
  }
  if (request.simple_text_search) {
    return undefined;
  }
  if (clauses.length === 0) {
    return undefined;
  }
  if (clauses.length === 1) {
    return clauses[0];
  }
  return new BoolQuery({ must: clauses });
}

/** Parses one JSON DSL query clause into the equivalent Querylight query object. */
export function parseJsonDslQuery({ query }: ParseJsonDslQueryParams): Query {
  const body = assertRecord(query, "query");
  const [kind, rawConfig] = singleFieldEntry(body, "query");

  switch (kind) {
    case "match_all": {
      const config = rawConfig == null ? {} : assertRecord(rawConfig, "match_all");
      return new MatchAll(definedProps({ boost: asOptionalNumber(config.boost, "match_all.boost") }) as any);
    }
    case "term": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "term"), "term");
      if (typeof value === "string") {
        return new TermQuery({ field, text: value });
      }
      const config = assertRecord(value, `term.${field}`);
      return new TermQuery(definedProps({
        field,
        text: assertString(config.value, `term.${field}.value`),
        boost: asOptionalNumber(config.boost, `term.${field}.boost`)
      }) as any);
    }
    case "terms": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "terms"), "terms");
      if (Array.isArray(value)) {
        return new TermsQuery({ field, terms: value.map((entry, index) => assertString(entry, `terms.${field}[${index}]`)) });
      }
      const config = assertRecord(value, `terms.${field}`);
      return new TermsQuery(definedProps({
        field,
        terms: assertArray(config.terms, `terms.${field}.terms`).map((entry, index) => assertString(entry, `terms.${field}.terms[${index}]`)),
        boost: asOptionalNumber(config.boost, `terms.${field}.boost`)
      }) as any);
    }
    case "wildcard": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "wildcard"), "wildcard");
      if (typeof value === "string") {
        return new WildcardQuery({ field, pattern: value });
      }
      const config = assertRecord(value, `wildcard.${field}`);
      return new WildcardQuery(definedProps({
        field,
        pattern: assertString(config.value, `wildcard.${field}.value`),
        boost: asOptionalNumber(config.boost, `wildcard.${field}.boost`)
      }) as any);
    }
    case "regexp": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "regexp"), "regexp");
      if (typeof value === "string") {
        return new RegexpQuery({ field, pattern: value });
      }
      const config = assertRecord(value, `regexp.${field}`);
      return new RegexpQuery(definedProps({
        field,
        pattern: assertString(config.value, `regexp.${field}.value`),
        boost: asOptionalNumber(config.boost, `regexp.${field}.boost`)
      }) as any);
    }
    case "exists": {
      const config = assertRecord(rawConfig, "exists");
      return new ExistsQuery(definedProps({
        field: assertString(config.field, "exists.field"),
        boost: asOptionalNumber(config.boost, "exists.boost")
      }) as any);
    }
    case "range": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "range"), "range");
      const config = parseRangeBounds(value, `range.${field}`);
      return new RangeQuery(definedProps({
        field,
        range: definedProps({
          gt: config.gt,
          gte: config.gte,
          lt: config.lt,
          lte: config.lte
        }),
        boost: config.boost
      }) as any);
    }
    case "match": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "match"), "match");
      if (typeof value === "string") {
        return new MatchQuery({ field, text: value });
      }
      const config = assertRecord(value, `match.${field}`);
      return new MatchQuery(definedProps({
        field,
        text: assertString(config.query, `match.${field}.query`),
        operation: parseOperator(config.operator),
        prefixMatch: config.prefix_match === true,
        boost: asOptionalNumber(config.boost, `match.${field}.boost`)
      }) as any);
    }
    case "multi_match": {
      const config = assertRecord(rawConfig, "multi_match");
      const parsedFields = parseFieldBoosts(
        assertArray(config.fields, "multi_match.fields").map((entry, index) => assertString(entry, `multi_match.fields[${index}]`)),
        config.field_boosts == null ? {} : Object.fromEntries(
          Object.entries(assertRecord(config.field_boosts, "multi_match.field_boosts"))
            .map(([field, boost]) => [field, assertNumber(boost, `multi_match.field_boosts.${field}`)])
        )
      );
      return new MultiMatchQuery(definedProps({
        fields: parsedFields.fields,
        text: assertString(config.query, "multi_match.query"),
        operation: parseOperator(config.operator),
        prefixMatch: config.prefix_match === true,
        boost: asOptionalNumber(config.boost, "multi_match.boost"),
        fieldBoosts: parsedFields.fieldBoosts
      }) as any);
    }
    case "bool": {
      const config = assertRecord(rawConfig, "bool");
      return new BoolQuery(definedProps({
        must: config.must == null ? [] : normalizeArrayOfQueries(config.must, "bool.must"),
        should: config.should == null ? [] : normalizeArrayOfQueries(config.should, "bool.should"),
        filter: config.filter == null ? [] : normalizeArrayOfQueries(config.filter, "bool.filter"),
        mustNot: config.must_not == null ? [] : normalizeArrayOfQueries(config.must_not, "bool.must_not"),
        minimumShouldMatch: config.minimum_should_match == null ? undefined : assertInteger(config.minimum_should_match, "bool.minimum_should_match"),
        boost: asOptionalNumber(config.boost, "bool.boost")
      }) as any);
    }
    case "dis_max": {
      const config = assertRecord(rawConfig, "dis_max");
      return new DisMaxQuery(definedProps({
        queries: assertArray(config.queries, "dis_max.queries").map((entry, index) => parseJsonDslQuery({ query: assertRecord(entry, `dis_max.queries[${index}]`) })),
        tieBreaker: config.tie_breaker == null ? undefined : assertNumber(config.tie_breaker, "dis_max.tie_breaker"),
        boost: asOptionalNumber(config.boost, "dis_max.boost")
      }) as any);
    }
    case "match_phrase": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "match_phrase"), "match_phrase");
      if (typeof value === "string") {
        return new MatchPhrase({ field, text: value });
      }
      const config = assertRecord(value, `match_phrase.${field}`);
      return new MatchPhrase(definedProps({
        field,
        text: assertString(config.query, `match_phrase.${field}.query`),
        slop: config.slop == null ? undefined : assertInteger(config.slop, `match_phrase.${field}.slop`),
        boost: asOptionalNumber(config.boost, `match_phrase.${field}.boost`)
      }) as any);
    }
    case "prefix": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "prefix"), "prefix");
      if (typeof value === "string") {
        return new PrefixQuery({ field, prefix: value });
      }
      const config = assertRecord(value, `prefix.${field}`);
      return new PrefixQuery(definedProps({
        field,
        prefix: assertString(config.value, `prefix.${field}.value`),
        boost: asOptionalNumber(config.boost, `prefix.${field}.boost`)
      }) as any);
    }
    case "boosting": {
      const config = assertRecord(rawConfig, "boosting");
      return new BoostingQuery(definedProps({
        positive: parseJsonDslQuery({ query: assertRecord(config.positive, "boosting.positive") }),
        negative: parseJsonDslQuery({ query: assertRecord(config.negative, "boosting.negative") }),
        negativeBoost: assertNumber(config.negative_boost, "boosting.negative_boost"),
        boost: asOptionalNumber(config.boost, "boosting.boost")
      }) as any);
    }
    case "geo_shape": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "geo_shape"), "geo_shape");
      const config = assertRecord(value, `geo_shape.${field}`);
      const shape = assertRecord(config.shape, `geo_shape.${field}.shape`);
      const type = assertString(shape.type, `geo_shape.${field}.shape.type`);
      if (type === "Point") {
        const point = parseGeoPoint(shape.coordinates);
        return new GeoPointQuery(definedProps({
          field,
          latitude: point.latitude,
          longitude: point.longitude,
          boost: asOptionalNumber(config.boost, `geo_shape.${field}.boost`)
        }) as any);
      }
      if (type === "Polygon") {
        return new GeoPolygonQuery(definedProps({
          field,
          polygon: parsePolygonCoordinates(shape.coordinates),
          boost: asOptionalNumber(config.boost, `geo_shape.${field}.boost`)
        }) as any);
      }
      throw new Error(`unsupported geo shape type: ${type}`);
    }
    case "geo_point": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "geo_point"), "geo_point");
      if (Array.isArray(value)) {
        const point = parseGeoPoint(value);
        return new GeoPointQuery({ field, latitude: point.latitude, longitude: point.longitude });
      }
      const config = assertRecord(value, `geo_point.${field}`);
      const point = parseGeoPoint(config.point ?? config);
      return new GeoPointQuery(definedProps({
        field,
        latitude: point.latitude,
        longitude: point.longitude,
        boost: asOptionalNumber(config.boost, `geo_point.${field}.boost`)
      }) as any);
    }
    case "geo_polygon": {
      const [field, value] = singleFieldEntry(assertRecord(rawConfig, "geo_polygon"), "geo_polygon");
      const config = assertRecord(value, `geo_polygon.${field}`);
      return new GeoPolygonQuery(definedProps({
        field,
        polygon: parsePolygonCoordinates(config.points ?? config.coordinates),
        boost: asOptionalNumber(config.boost, `geo_polygon.${field}.boost`)
      }) as any);
    }
    case "distance_feature": {
      const config = assertRecord(rawConfig, "distance_feature");
      return new DistanceFeatureQuery(definedProps({
        field: assertString(config.field, "distance_feature.field"),
        origin: config.origin as string | number | Date,
        pivot: assertNumber(config.pivot, "distance_feature.pivot"),
        boost: asOptionalNumber(config.boost, "distance_feature.boost")
      }) as any);
    }
    case "rank_feature": {
      const config = assertRecord(rawConfig, "rank_feature");
      return new RankFeatureQuery(definedProps({
        field: assertString(config.field, "rank_feature.field"),
        options: parseRankFeatureOptions(config),
        boost: asOptionalNumber(config.boost, "rank_feature.boost")
      }) as any);
    }
    case "script": {
      const config = assertRecord(rawConfig, "script");
      return new ScriptQuery(definedProps({
        script: createFilterScript(compileScript(config.script, "script.script")),
        boost: asOptionalNumber(config.boost, "script.boost")
      }) as any);
    }
    case "script_score": {
      const config = assertRecord(rawConfig, "script_score");
      return new ScriptScoreQuery(definedProps({
        query: parseJsonDslQuery({ query: assertRecord(config.query, "script_score.query") }),
        script: createScoreScript(compileScript(config.script, "script_score.script")),
        boost: asOptionalNumber(config.boost, "script_score.boost")
      }) as any);
    }
    case "rrf": {
      const config = assertRecord(rawConfig, "rrf");
      return new ReciprocalRankFusionQuery(definedProps({
        queries: assertArray(config.queries, "rrf.queries").map((entry, index) => parseJsonDslQuery({ query: assertRecord(entry, `rrf.queries[${index}]`) })),
        options: definedProps({
          rankConstant: asOptionalNumber(config.rank_constant, "rrf.rank_constant"),
          weights: config.weights == null
            ? undefined
            : assertArray(config.weights, "rrf.weights").map((entry, index) => assertNumber(entry, `rrf.weights[${index}]`))
        }),
        boost: asOptionalNumber(config.boost, "rrf.boost")
      }) as any);
    }
    case "knn": {
      const config = parseDenseVectorClause(rawConfig);
      return new KnnQuery(config);
    }
    case "sparse_vector":
    case "neural_sparse": {
      const config = parseSparseVectorClause(rawConfig, kind);
      return new SparseVectorQuery(config);
    }
    case "vector_rescore": {
      const config = assertRecord(rawConfig, "vector_rescore");
      return new VectorRescoreQuery(definedProps({
        field: assertString(config.field, "vector_rescore.field"),
        vector: assertArray(config.vector, "vector_rescore.vector").map((entry, index) => assertNumber(entry, `vector_rescore.vector[${index}]`)),
        query: parseJsonDslQuery({ query: assertRecord(config.query, "vector_rescore.query") }),
        options: definedProps({
          windowSize: config.window_size == null ? undefined : assertInteger(config.window_size, "vector_rescore.window_size"),
          queryWeight: asOptionalNumber(config.query_weight, "vector_rescore.query_weight"),
          rescoreQueryWeight: asOptionalNumber(config.rescore_query_weight, "vector_rescore.rescore_query_weight")
        }),
        boost: asOptionalNumber(config.boost, "vector_rescore.boost")
      }) as any);
    }
    case "sparse_vector_rescore": {
      const config = assertRecord(rawConfig, "sparse_vector_rescore");
      return new SparseVectorRescoreQuery(definedProps({
        field: assertString(config.field, "sparse_vector_rescore.field"),
        vector: assertRecord(config.vector, "sparse_vector_rescore.vector") as SparseVector,
        query: parseJsonDslQuery({ query: assertRecord(config.query, "sparse_vector_rescore.query") }),
        options: definedProps({
          windowSize: config.window_size == null ? undefined : assertInteger(config.window_size, "sparse_vector_rescore.window_size"),
          queryWeight: asOptionalNumber(config.query_weight, "sparse_vector_rescore.query_weight"),
          rescoreQueryWeight: asOptionalNumber(config.rescore_query_weight, "sparse_vector_rescore.rescore_query_weight")
        }),
        boost: asOptionalNumber(config.boost, "sparse_vector_rescore.boost")
      }) as any);
    }
    default:
      throw new Error(`unsupported query type: ${kind}`);
  }
}

/** Executes an OpenSearch-style JSON request and returns hits, highlights, and aggregations. */
export async function searchJsonDsl({ index, request, indexName = "querylight" }: SearchJsonDslParams): Promise<JsonDslResponse> {
  const startedAt = Date.now();
  const documentIndex = rootDocumentIndex(index);
  const query = parseTopLevelQuery(request);
  const from = request.from ?? 0;
  const size = request.size ?? 20;
  const allHits = request.simple_text_search
    ? (() => {
        if (!isSimpleTextSearchIndex(index)) {
          throw new Error("simple_text_search requires a SimpleTextSearchIndex");
        }
        return simpleTextSearch(index, {
          query: request.simple_text_search.query,
          from: 0,
          limit: Math.max(index.documents.length, from + size)
        });
      })()
    : query
      ? documentIndex.search(query, 0, Number.MAX_SAFE_INTEGER)
      : Promise.resolve([...documentIndex.ids()].map((id): [string, number] => [id, 1.0]));
  const resolvedHits = await allHits;
  const pageHits = resolvedHits.slice(from, Math.min(from + size, resolvedHits.length));
  const maxScore = pageHits.length > 0 ? Math.max(...pageHits.map(([, score]) => score)) : null;

  const hits: JsonDslSearchHit[] = pageHits.flatMap(([id, score]) => {
      const source = sourceForHit(index, id);
      if (!source) {
        return [];
      }
      return [definedProps({
        _index: indexName,
        _id: id,
        _score: score,
        _source: source,
        highlight: formatHighlight(documentIndex, id, query, request.highlight)
      }) as JsonDslSearchHit];
    });

  const aggregationsConfig = request.aggs ?? request.aggregations;
  const aggregations = aggregationsConfig
    ? Object.fromEntries(
      Object.entries(aggregationsConfig)
        .map(([name, clause]) => [name, computeAggregation(documentIndex, aggregationSubset(resolvedHits), clause)])
    )
    : undefined;

  return definedProps({
    took: Date.now() - startedAt,
    hits: {
      total: {
        value: resolvedHits.length,
        relation: "eq" as const
      },
      max_score: maxScore,
      hits
    },
    aggregations
  }) as JsonDslResponse;
}
