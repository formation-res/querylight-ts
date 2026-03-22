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

export { DateFieldIndex, DocumentIndex, GeoFieldIndex, NumericFieldIndex, TextFieldIndex } from "./document-index";

export {
  BoolQuery,
  BoostingQuery,
  DisMaxQuery,
  DistanceFeatureQuery,
  ExistsQuery,
  GeoPointQuery,
  GeoPolygonQuery,
  MatchAll,
  MultiMatchQuery,
  MatchPhrase,
  MatchQuery,
  OP,
  PrefixQuery,
  RankFeatureQuery,
  RangeQuery,
  RegexpQuery,
  ScriptQuery,
  ScriptScoreQuery,
  TermQuery,
  TermsQuery,
  WildcardQuery,
  VectorRescoreQuery
} from "./query";
export type {
  RankFeatureLinearOptions,
  RankFeatureLogOptions,
  RankFeatureOptions,
  RankFeatureSaturationOptions,
  RankFeatureSigmoidOptions,
  ScriptExecutionContext,
  ScriptFilter,
  ScriptScore,
  VectorRescoreOptions
} from "./query";
export type { Query } from "./shared";

export {
  VectorFieldIndex,
  bigramVector,
  cosineSimilarity,
  generateRandomVector,
  hashFunction,
  normalizeVector,
  populateLSHBuckets
} from "./vector";
export type { Vector, VectorFieldIndexState } from "./vector";

export {
  createSimpleTextSearchIndex,
  simpleTextSearch
} from "./simple-text-search";
export type {
  CreateSimpleTextSearchIndexOptions,
  SimpleTextSearchIndex,
  SimpleTextSearchRequest
} from "./simple-text-search";
