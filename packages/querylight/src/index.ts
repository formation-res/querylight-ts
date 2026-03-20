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
  type Hit,
  type Hits,
  type IndexState,
  type IndexStateBase,
  QueryContext,
  RankingAlgorithm,
  type ReciprocalRankFusionOptions,
  type SearchRequest,
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

export { DocumentIndex, GeoFieldIndex, TextFieldIndex } from "./document-index";

export {
  BoolQuery,
  ExistsQuery,
  GeoPointQuery,
  GeoPolygonQuery,
  MatchAll,
  MultiMatchQuery,
  MatchPhrase,
  MatchQuery,
  OP,
  PrefixQuery,
  RangeQuery,
  TermQuery,
  TermsQuery
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
