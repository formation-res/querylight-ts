export {
  Analyzer,
  EdgeNgramsTokenFilter,
  ElisionTextFilter,
  InterpunctionTextFilter,
  KeywordTokenizer,
  LowerCaseTextFilter,
  NgramTokenFilter,
  SplittingTokenizer
} from "./analysis";
export type { AnalyzedToken, TextFilter, TokenFilter, Tokenizer } from "./analysis";

export {
  decodeGeohash,
  decodeGeohashBounds,
  eastGeohash,
  encodeGeohash,
  geohashContains,
  geohashesForGeometry,
  geometryContainsPoint,
  geometryIntersectsGeohash,
  geometryIntersectsPolygon,
  northGeohash,
  rectangleToPolygon
} from "./geo";
export type { Geometry, MultiPolygonCoordinates, PolygonCoordinates } from "./geo";

export { createSeededRandom } from "./random";
export type { RandomSource } from "./random";

export { SimpleStringTrie, TrieNode } from "./trie";
export type { TrieNodeState } from "./trie";

export { deserializeCompressedJson, serializeCompressedJson } from "./compressed-json";
export type { DeserializeCompressedJsonParams, SerializeCompressedJsonParams } from "./compressed-json";

export {
  type Bm25Config,
  type DateFieldIndexState,
  type Document,
  type DocumentIndexState,
  type FieldIndex,
  type GeoFieldIndexState,
  type HighlightClause,
  type HighlightFieldResult,
  type HighlightFragment,
  type HighlightFragmentPart,
  type HighlightRequest,
  type HighlightResult,
  type HighlightSpan,
  type DateHistogramBucket,
  type Hit,
  type Hits,
  type IndexState,
  type IndexStateBase,
  type NumericHistogramBucket,
  type NumericRangeAggregationBucket,
  type NumericRangeAggregationRange,
  type NumericStatsAggregation,
  type NumericFieldIndexState,
  QueryContext,
  RankingAlgorithm,
  type ReciprocalRankFusionOptions,
  type SearchRequest,
  type SignificantTermsBucket,
  type StoredSourceIndexState,
  type TermPos,
  type TextFieldIndexState,
  andHits,
  applyBoost,
  defaultBm25Config,
  ids,
  normalizedBoost,
  orHits,
  reciprocalRankFusion
} from "./shared";

export {
  DateFieldIndex,
  deserializeDocumentIndex,
  DocumentIndex,
  GeoFieldIndex,
  NumericFieldIndex,
  serializeDocumentIndex,
  StoredSourceIndex,
  TextFieldIndex
} from "./document-index";
export type { DeserializeDocumentIndexParams, SerializeDocumentIndexParams } from "./document-index";

export {
  BoolQuery,
  BoostingQuery,
  DisMaxQuery,
  DistanceFeatureQuery,
  ExistsQuery,
  GeoPointQuery,
  GeoPolygonQuery,
  KnnQuery,
  MatchAll,
  MultiMatchQuery,
  MatchPhrase,
  MatchQuery,
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
  WildcardQuery,
  VectorRescoreQuery
} from "./query";
export type {
  BoolQueryParams,
  BoostingQueryParams,
  DisMaxQueryParams,
  DistanceFeatureQueryParams,
  ExistsQueryParams,
  GeoPointQueryParams,
  GeoPolygonQueryParams,
  KnnQueryParams,
  MatchAllParams,
  MatchPhraseParams,
  MatchQueryParams,
  MultiMatchQueryParams,
  PrefixQueryParams,
  ReciprocalRankFusionQueryParams,
  RankFeatureLinearOptions,
  RankFeatureLogOptions,
  RankFeatureQueryParams,
  RankFeatureOptions,
  RankFeatureSaturationOptions,
  RankFeatureSigmoidOptions,
  RangeQueryParams,
  RegexpQueryParams,
  ScriptExecutionContext,
  ScriptFilter,
  ScriptQueryParams,
  ScriptScore,
  ScriptScoreQueryParams,
  SparseVectorQueryParams,
  SparseVectorRescoreQueryParams,
  TermQueryParams,
  TermsQueryParams,
  VectorRescoreQueryParams,
  VectorRescoreOptions,
  WildcardQueryParams
} from "./query";
export type { Query } from "./shared";

export { parseJsonDslQuery, searchJsonDsl } from "./dsl";
export type {
  JsonDslAggregationClause,
  JsonDslAggregationResult,
  JsonDslHighlight,
  JsonDslHighlightField,
  JsonDslHits,
  JsonDslQueryClause,
  JsonDslRequest,
  JsonDslResponse,
  JsonDslSimpleTextSearchRequest,
  JsonDslScript,
  JsonDslSearchHit,
  ParseJsonDslQueryParams,
  SearchJsonDslParams
} from "./dsl";

export {
  CpuVectorScorer,
  VectorFieldIndex,
  bigramVector,
  cosineSimilarity,
  generateRandomVector,
  hashFunction,
  normalizeVector,
  populateLSHBuckets
} from "./vector";
export type {
  AsyncVectorScorer,
  PreparedVector,
  Vector,
  VectorFieldIndexOptions,
  VectorFieldIndexParams,
  VectorFieldIndexState,
  VectorScorer
} from "./vector";

export {
  SparseVectorFieldIndex,
  sparseInnerProduct
} from "./sparse-vector";
export type {
  SparseVector,
  SparseVectorFieldIndexParams,
  SparseVectorFieldIndexState
} from "./sparse-vector";

export {
  createSimpleTextSearchIndex,
  deserializeSimpleTextSearchIndex,
  serializeSimpleTextSearchIndex,
  simpleTextSearch
} from "./simple-text-search";
export type {
  CreateSimpleTextSearchIndexOptions,
  DeserializeSimpleTextSearchIndexParams,
  SerializeSimpleTextSearchIndexParams,
  SimpleTextSearchIndex,
  SimpleTextSearchIndexState,
  SimpleTextSearchRequest
} from "./simple-text-search";
